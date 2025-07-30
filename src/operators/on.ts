
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
 *       error: (err) => console.error('Stream error:', err)
 *     })
 *   )
 * ```
 */
export function on<T>(callbacks: {
  start?(): void;
  complete?(reason?: any): void;
  error?(err: any): void;
}): (src: ReadableStream<T>, opts?: { highWaterMark: number; }) => ReadableStream<T> {
  let reader: ReadableStreamDefaultReader<T> | null = null;

  async function flush(controller: ReadableStreamDefaultController<T>) {
    try {
      while (controller.desiredSize > 0 && reader != null) {
        const next = await reader.read();
        if (next.done) {
          controller.close();
          if (reader) {
            reader.releaseLock();
            reader = null;
          }
          if (callbacks.complete) {
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
          reader.cancel(err);
          reader.releaseLock();
        } catch (e) {
          // Ignore cleanup errors
        }
        reader = null;
      }
      if (callbacks.error) {
        try {
          callbacks.error(err);
        } catch (callbackErr) {
          console.error('Error in error callback:', callbackErr);
        }
      }
    }
  }

  return function (src: ReadableStream<T>, opts?: { highWaterMark: number; }) {
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
        if (reader) {
          try {
            reader.cancel(reason);
            reader.releaseLock();
          } catch (err) {
            // Ignore cleanup errors
          } finally {
            reader = null;
          }
          if (callbacks.complete) {
            try {
              callbacks.complete(reason);
            } catch (err) {
              console.error('Error in complete callback:', err);
            }
          }
        }
      }
    }, opts);
  };
}
