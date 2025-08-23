/**
 * Lifecycle callbacks for stream events.
 * 
 * These callbacks provide hooks into different stages of a stream's lifecycle,
 * allowing for side effects like logging, cleanup, or state management.
 */
export type LifecycleCallbacks = {
  /**
   * Called when the stream starts reading from the source.
   * Invoked during the ReadableStream's start() method.
   */
  start?(): void;
  
  /**
   * Called when the stream completes naturally.
   * This occurs when the source stream ends normally (reader.read() returns done: true).
   * This is NOT called when the stream is cancelled by the consumer.
   */
  complete?(): void;
  
  /**
   * Called when the consumer cancels/aborts the output stream.
   * This occurs when the consumer of the output stream calls cancel() or abort().
   * The reason parameter contains the cancellation reason provided by the consumer.
   * 
   * @param reason - The reason for cancellation provided by the consumer
   */
  cancel?(reason?: any): void;
  
  /**
   * Called when the source stream encounters an error.
   * This occurs when the input stream fails, read operations throw, or other
   * producer-side errors happen. This represents involuntary stream termination
   * due to infrastructure failures, data corruption, etc.
   * 
   * @param err - The error that caused the stream to fail
   */
  error?(err: any): void;
};

/**
 * Creates an operator that allows attaching lifecycle callbacks to a stream.
 * This is useful for side effects like logging, cleanup, or state management
 * without modifying the stream's data flow.
 * 
 * @template T The type of values in the stream
 * @param callbacks Object containing optional lifecycle callbacks
 * @returns A transform function that can be used with pipe()
 * 
 * @example
 * ```typescript
 * from([1, 2, 3])
 *   .pipe(
 *     on({
 *       start: () => console.log('Stream started'),
 *       complete: () => console.log('Stream completed'),
 *       cancel: (reason) => console.log('Stream cancelled:', reason),
 *       error: (err) => console.error('Stream error:', err)
 *     })
 *   )
 * ```
 */
export function on<T>(callbacks: LifecycleCallbacks): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T> {
  let reader: ReadableStreamDefaultReader<T> | null = null;
  let cancelled = false;

  async function flush(controller: ReadableStreamDefaultController<T>) {
    try {
      while (controller.desiredSize > 0 && reader != null && !cancelled) {
        const next = await reader.read();
        if (next.done) {
          controller.close();
          if (reader) {
            reader.releaseLock();
            reader = null;
          }
          // Only call complete if we weren't cancelled
          if (!cancelled && callbacks.complete) {
            try {
              callbacks.complete();
            } catch (err) {
              console.error('Error in complete callback:', err);
            }
          }
        } else {
          controller.enqueue(next.value);
        }
      }
    } catch (err) {
      controller.error(err);
      // Cleanup on error
      if (reader) {
        try {
          await reader.cancel(err);
          reader.releaseLock();
        } catch (e) {
          // Ignore cleanup errors
        }
        reader = null;
      }
      // Only call error callback if we weren't cancelled - cancellation should only trigger cancel callback
      if (!cancelled && callbacks.error) {
        try {
          callbacks.error(err);
        } catch (callbackErr) {
          console.error('Error in error callback:', callbackErr);
        }
      }
    }
  }

  return function (src: ReadableStream<T>, strategy: QueuingStrategy<T> = { highWaterMark: 16 }) {
    return new ReadableStream<T>({
      start(controller) {
        reader = src.getReader();
        if (callbacks.start) {
          try {
            callbacks.start();
          } catch (err) {
            console.error('Error in start callback:', err);
          }
        }
        return flush(controller);
      },
      pull(controller) {
        return flush(controller);
      },
      cancel(reason?: any) {
        cancelled = true;  // Mark as cancelled first
        if (reader) {
          try {
            reader.cancel(reason).catch(() => {
              // Ignore cancel errors
            });
            reader.releaseLock();
          } catch (err) {
            // Ignore cleanup errors
          } finally {
            reader = null;
          }
        }
        if (callbacks.cancel) {
          try {
            callbacks.cancel(reason);
          } catch (err) {
            console.error('Error in cancel callback:', err);
          }
        }
      }
    }, strategy);
  };
}