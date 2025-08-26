/**
 * Defines the overflow policy for tee function when a branch's buffer exceeds its capacity.
 * 
 * @public
 */
export type OverflowPolicy = 'block' | 'throw' | 'cancel';

/**
 * Options for configuring the tee function behavior.
 */
export interface TeeOptions<T> {
  /** Overflow policy when a branch buffer exceeds capacity. default: 'block' */
  overflow?: OverflowPolicy;
  /** Queuing strategy for each branch stream */
  strategy?: QueuingStrategy<T>;
}

/**
 * Splits a single ReadableStream into multiple identical streams.
 * Each output stream receives the same data from the source stream.
 * 
 * @example
 * Basic usage:
 * ```typescript
 * const source = from([1, 2, 3]);
 * const [streamA, streamB] = tee(source, 2);
 * 
 * // Both streams will receive: [1, 2, 3]
 * const resultA = await toArray(streamA);
 * const resultB = await toArray(streamB);
 * ```
 * 
 * @example
 * With overflow policy:
 * ```typescript
 * const source = from([1, 2, 3, 4, 5]);
 * const [fast, slow] = tee(source, 2, { 
 *   overflow: 'block',
 *   strategy: { highWaterMark: 1 }
 * });
 * 
 * // Fast consumer will be blocked by slow consumer once the highWaterMark is reached
 * 
 * // Alternatively, with 'throw' policy:
 * const [fastThrow, slowThrow] = tee(source, 2, { 
 *   overflow: 'throw',
 *   strategy: { highWaterMark: 1 }
 * });
 * // Only the slow consumer branch will error on overflow, fast consumer continues
 * 
 * // Or with 'cancel' policy:
 * const [fastCancel, slowCancel] = tee(source, 2, { 
 *   overflow: 'cancel',
 *   strategy: { highWaterMark: 1 }
 * });
 * // All branches error and source is cancelled when any branch overflows
 * ```
 * 
 * @param src - The source ReadableStream to split
 * @param count - Number of output streams to create. Must be >= 1.
 * @param options - Configuration options for the tee function
 * @param options.overflow - Overflow policy when a branch buffer is full:
 *   - 'block' (default): Blocks reading from source until all branches have capacity
 *   - 'throw': Errors only the overflowing branch, other branches continue normally
 *   - 'cancel': Errors all branches and cancels source when any branch overflows
 * @param options.strategy - Custom QueuingStrategy for the output streams.
 * 
 * @returns An array of identical ReadableStreams.
 * 
 * @throws {Error} If count is not an integer >= 1
 * @throws {Error} If overflow policy is not 'block', 'throw', or 'cancel'
 * 
 * @remarks
 * **Cancellation Behavior:**
 * - Individual branch cancellations don't affect other branches or the source
 * - Source is only cancelled when ALL branches are cancelled
 * - Cancel reason from the last cancelled branch is used for source cancellation
 * 
 * **Error Behavior:**
 * - Any error in the source or producer loop errors ALL branches
 * - With 'throw' overflow policy, only the overflowing branch errors, others continue
 * - With 'cancel' overflow policy, buffer overflow errors ALL branches and cancels source
 * - With 'block' overflow policy, source reading is paused until capacity is available
 * 
 * **Performance Considerations:**
 * - Uses controller.desiredSize to track buffer state efficiently
 * - Microtask-based producer restart prevents deadlocks
 * - No internal queues - relies on native ReadableStream buffering
 * 
 * @public
 */
export function tee<T>(
  src: ReadableStream<T>,
  count: number,
  options: TeeOptions<T> = {}
): ReadableStream<T>[] {

  if (!Number.isInteger(count) || count < 1) throw new Error('tee(count) expects count to be an integer >= 1');
  const overflow = options.overflow || 'block';

  if(overflow !== "block" && overflow !== "throw" && overflow !== "cancel"){
    throw new Error("overflow option must be either block, throw, or cancel");
  }
  
  if (count === 1) return [src];

  const strategy = options.strategy ?? { highWaterMark: 16 };
  const highWaterMark = strategy.highWaterMark ?? 16;

  // State - no internal queues, rely on controller buffering
  const controllers: Array<ReadableStreamDefaultController<T> | null> = Array.from({ length: count }, () => null);
  const waiters: Array<(() => void) | null> = Array.from({ length: count }, () => null);

  let reading = false;
  let readerClosing = false;
  let reader: ReadableStreamDefaultReader<T> | null = null;
  let sourceExhausted = false;
  let pendingRestart = false;

  /**
   * Errors all branches and cancels the source stream.
   * Used when any unrecoverable error occurs, including overflow in 'cancel' mode.
   * 
   * @param error - The error to propagate to all branches
   * @internal
   */
  function errorAllBranches(error: Error) {
    // Mark as closing to prevent further operations
    readerClosing = true;
    sourceExhausted = true;
    
    // Error all active branches
    for (const [index, controller] of controllers.entries()) {
      if (controller) {
        try {
          controller.error(error);
        } catch {
          // Ignore errors when erroring the controller - it might already be closed
        }
        controllers[index] = null; // Mark as inactive
      }
      // Notify any waiters so they don't hang
      if (waiters[index]) {
        const resolve = waiters[index]!;
        waiters[index] = null;
        resolve();
      }
    }
    
    // Cancel the source stream
    if (reader) {
      try {
        reader.cancel(error.message);
      } catch {
        // Ignore errors when cancelling - reader might already be closed
      }
    }
  }

  /**
   * Errors a specific branch without affecting other branches or the source stream.
   * Used when overflow policy is 'throw' to isolate errors to the problematic branch.
   * 
   * @param branchIndex - Index of the branch to error
   * @param error - The error to propagate to the specific branch
   * @internal
   */
  function errorBranch(branchIndex: number, error: Error) {
    const controller = controllers[branchIndex];
    if (controller) {
      try {
        controller.error(error);
      } catch {
        // Ignore errors when erroring the controller - it might already be closed
      }
      controllers[branchIndex] = null; // Mark as inactive
    }
    
    // Notify waiter if one exists for this branch
    if (waiters[branchIndex]) {
      const resolve = waiters[branchIndex]!;
      waiters[branchIndex] = null;
      resolve();
    }
  }

  /**
   * Triggers a restart of the producer loop when capacity becomes available.
   * Uses microtasks to prevent deadlocks and ensure proper scheduling.
   * 
   * @internal
   */
  function triggerProducerRestart() {
    if (!reading && !sourceExhausted && reader && !pendingRestart) {

      pendingRestart = true;
      // Use microtask to restart producer loop
      Promise.resolve().then(() => {
        pendingRestart = false;
        if (!reading && !sourceExhausted) {
          reading = true;
          produceLoop();
        }
      });
    }
  }

  /**
   * Checks if a branch can accept new data based on its current buffer state.
   * Uses controller.desiredSize to determine actual buffered count efficiently.
   * 
   * @param i - Index of the branch to check
   * @returns True if the branch can accept data, false otherwise
   * @internal
   */
  function branchCanAccept(i: number): boolean {
    const controller = controllers[i];
    if (!controller) return false;

    const hasWaiter = waiters[i] !== null;
    // controller.desiredSize > 0 means the buffer has capacity
    const hasCapacity = (controller.desiredSize ?? 0) > 0;

    // For blocking policy: branch can accept if it has capacity OR if it has an active waiter
    // Waiters indicate active consumption, so we should allow data for them
    const canAccept = hasCapacity || hasWaiter;

    return canAccept;
  }

  /**
   * Main producer loop that reads from the source and distributes data to all branches.
   * Handles overflow policies and coordinates between branches.
   * 
   * @internal
   */
  async function produceLoop() {
    try {

      while (true) {
        // For 'block' policy, we need ALL branches to be able to accept
        // For 'throw'/'cancel' policies, we continue as long as at least one branch can accept
        let canContinue;
        if (overflow === 'block') {
          canContinue = Array.from({ length: count }, (_, i) => branchCanAccept(i)).every(Boolean);
        } else {
          // For throw/cancel policies, continue if any branch can accept
          canContinue = Array.from({ length: count }, (_, i) => branchCanAccept(i)).some(Boolean);
        }

        if (!canContinue) {
          reading = false;
          return; // This will exit the produce loop, we'll be called again when there's capacity
        }

        const res = await reader!.read();

        if (res.done || readerClosing) {
          sourceExhausted = true;
          // Close all active branches
          for (const [index, controller] of controllers.entries()) {
            if (controller) {
              controller.close();
            }
            // Notify any waiters so they don't hang
            if (waiters[index]) {

              const resolve = waiters[index]!;
              waiters[index] = null;
              resolve();
            }
          }
          return;
        }

        // Enqueue to all branches
        for (let i = 0; i < count; i++) {
          const controller = controllers[i];
          if (controller) {
            // Apply overflow policy before enqueuing
            if (overflow !== 'block') {
              // controller.desiredSize <= 0 means the buffer is at or over capacity
              if ((controller.desiredSize ?? 0) <= 0) {
                switch (overflow) {                  
                  case 'throw':
                    const throwError = new Error(`Queue overflow on branch ${i}`);
                    errorBranch(i, throwError);
                    continue; // Skip this branch but continue with others
                  case 'cancel':
                    const cancelError = new Error(`Queue overflow on branch ${i}`);
                    errorAllBranches(cancelError);
                    return; // Exit producer loop immediately
                }
              }
            }

            // Only enqueue if controller is still active (might have been errored above)
            if (controllers[i]) {
              controller.enqueue(res.value);

              // Notify waiter if one exists
              if (waiters[i]) {
                const resolve = waiters[i]!;
                waiters[i] = null;
                resolve();
              }
            }
          }
        }

        // Check if any branches are still active
        const activeBranches = controllers.filter(c => c !== null).length;
        if (activeBranches === 0) {
          sourceExhausted = true;
          return;
        }
      }
    } catch (err) {
      // Error all branches and cancel source
      errorAllBranches(err instanceof Error ? err : new Error(String(err)));
    } finally {

      reading = false;
    }
  }

  // Create output streams array
  const streams: ReadableStream<T>[] = new Array(count) as any;

  // Create each output stream with proper controller management
  for (let i = 0; i < count; i++) {
    ((index) => {
      streams[index] = new ReadableStream<T>({
        /**
         * Initialize the controller for this branch
         */
        start(controller) {
          controllers[index] = controller;
        },
        /**
         * Handle pull requests from this branch consumer
         */
        pull(controller) {
          // If source is exhausted, close this branch
          if (sourceExhausted) {
            controller.close();
            return;
          }

          // Initialize reader if needed
          if (!reader) {
            reader = src.getReader();
          }

          // Start producer if not already running
          if (!reading) {
            reading = true;
            produceLoop();
          }

          // Check if we already have data buffered
          const desiredSize = controller.desiredSize ?? 0;
          
          if (desiredSize >= 1) {
            // Buffer has space, need to wait for data
            // Set up waiter
            return new Promise<void>((resolve) => {
              waiters[index] = () => {
                resolve();
              };
              
              // Trigger producer restart in case it was blocked
              triggerProducerRestart();
            });
          }

          // Buffer has data, no need to wait
          return;
        },
        /**
         * Handle cancellation of this branch
         */
        cancel(reason) {
          // Mark this branch as cancelled
          controllers[index] = null;

          // If this is the last active branch, cancel the source
          const activeBranches = controllers.filter(c => c !== null).length;
          if (activeBranches === 0) {
            readerClosing = true;
            if (reader) {
              reader.cancel(reason);
            }
          }
        }
      }, strategy);
    })(i);
  }

  return streams;
}