/**
 * Defines the overflow policy for tee operator when a branch's buffer exceeds its capacity.
 * 
 * @public
 */
export type OverflowPolicy = 'block' | 'throw';

/**
 * Creates a tee operator that splits a single ReadableStream into multiple identical streams.
 * Each output stream receives the same data from the source stream.
 * This operator outputs one array value containing the tee'd streams and completes
 * 
 * @example
 * Basic usage:
 * ```typescript
 * const source = from([1, 2, 3]);
 * const [streamA, streamB] = tee<number>(2)(source);
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
 * const [fast, slow] = tee<number>(2, { 
 *   overflow: 'block',
 *   strategy: { highWaterMark: 1 }
 * })(source);
 * 
 * //Fast consumer will be blocked by slow consumer once the highWaterMark is reached
 * ```
 * 
 * @param count - Number of output streams to create. Must be >= 1.
 * @param options - Configuration options for the tee operator
 * @param options.overflow - Overflow policy when a branch buffer is full:
 *   - 'block' (default): Blocks reading from source until all branches have capacity
 *   - 'throw': Errors all branches and cancels source when any branch overflows
 * @param options.strategy - Custom QueuingStrategy for the output streams. 
 *   If not provided, falls back to the strategy passed to the pipe operation.
 * 
 * @returns A function that takes a source stream and optional pipe strategy, 
 *   returning an array of identical ReadableStreams.
 * 
 * @throws {Error} If count is not an integer >= 1
 * @throws {Error} If overflow policy is not 'block' or 'throw'
 * 
 * @remarks
 * **Cancellation Behavior:**
 * - Individual branch cancellations don't affect other branches or the source
 * - Source is only cancelled when ALL branches are cancelled
 * - Cancel reason from the last cancelled branch is used for source cancellation
 * 
 * **Error Behavior:**
 * - Any error in the source or producer loop errors ALL branches
 * - With 'throw' overflow policy, buffer overflow errors ALL branches and cancels source
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
  count: number,
  options: {
    /** Overflow policy when a branch buffer exceeds capacity. default: 'block' */
    overflow?: 'block' | 'throw';
    /** Override strategy just for this operator, falls back to pipe's strategy if undefined */  
    strategy?: QueuingStrategy<T>
  } = {})
  : (src: ReadableStream<T>, pipeStrategy?: QueuingStrategy<T>) => ReadableStream<T>[] {

  const opts = options || {};
  if (!Number.isInteger(count) || count < 1) throw new Error('tee(count) expects count to be an integer >= 1');
  const overflow = opts.overflow || 'block';

  if(overflow != "block" && overflow != "throw"){
    throw Error("overflow option must be either block or throw");
  }
  
  return function (src: ReadableStream<T>, pipeStrategy: QueuingStrategy<T> = { highWaterMark: 16 }): ReadableStream<T>[] {
    if (count === 1) return [src];

    const strategy = (opts.strategy ? opts.strategy : pipeStrategy) ?? {highWaterMark: 16}
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
     * Used when any unrecoverable error occurs, including overflow in 'throw' mode.
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
          controller.error(error);
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
        reader.cancel(error.message);
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
      // Use controller.desiredSize to determine actual buffered count
      const currentBuffered = Math.max(0, highWaterMark - (controller.desiredSize ?? 0));
      const hasCapacity = currentBuffered < highWaterMark;

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
          // For 'throw' policy, we continue as long as at least one branch can accept OR if no branches can accept but we haven't exceeded their limits
          let canContinue;
          if (overflow === 'block') {
            canContinue = Array.from({ length: count }, (_, i) => branchCanAccept(i)).every(Boolean);
          } else {
            // For throw policy, continue if any branch can accept, or if we can force through (overflow will be handled per branch)
            canContinue = Array.from({ length: count }, (_, i) => branchCanAccept(i)).some(Boolean) ||
                         Array.from({ length: count }, (_, i) => controllers[i] !== null).some(Boolean); // at least one active branch
          }

          if (!canContinue) {
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
                const currentBuffered = highWaterMark - (controller.desiredSize ?? 0);
                if (currentBuffered >= highWaterMark) {
                  switch (overflow) {                  
                    case 'throw':
                      const overflowError = new Error(`Queue overflow on branch ${i}`);
                      errorAllBranches(overflowError);
                      return; // Exit producer loop immediately
                  }
                }
              }

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
            
            if (desiredSize <= 0) {
              // Buffer is full, no need to wait
              return;
            }

            // Set up waiter
            return new Promise<void>((resolve) => {
              waiters[index] = () => {
                resolve();
              };
              
              // Trigger producer restart in case it was blocked
              triggerProducerRestart();
            });
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
  };
}