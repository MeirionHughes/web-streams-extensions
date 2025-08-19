/**
 * Emits an error if the duration waiting for a chunk exceeds the specified timeout.
 * Useful for detecting stalled streams or enforcing maximum wait times.
 * 
 * @template T The type of elements in the stream
 * @param duration Timeout duration in milliseconds
 * @returns A stream operator that adds timeout functionality
 * 
 * @example
 * ```typescript
 * let stream = pipe(
 *   from(slowAsyncGenerator()),
 *   timeout(5000) // Error if no value within 5 seconds
 * );
 * ```
 */
export function timeout<T>(duration: number): (src: ReadableStream<T>, opts?: { highWaterMark?: number }) => ReadableStream<T> {
  if (duration <= 0) {
    throw new Error("Timeout duration must be positive");
  }

  return function (src: ReadableStream<T>, opts?: { highWaterMark?: number }) {
    let reader: ReadableStreamDefaultReader<T> = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    function clearTimer() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    }

    async function pull(controller: ReadableStreamDefaultController<T>) {
      try {
        while (controller.desiredSize > 0 && reader != null && !cancelled) {
          let next = await reader.read();
          clearTimer();

          if (next.done) {
            controller.close();
            reader.releaseLock();
            reader = null;
            return;
          } else {
            controller.enqueue(next.value);

            // Set up timeout for next read
            timer = setTimeout(() => {
              timer = null;
              if (!cancelled) {
                controller.error(new Error(`Stream timeout after ${duration}ms`));
                if (reader) {
                  try {
                    reader.cancel("timeout").catch(() => {}); // Handle promise properly
                    reader.releaseLock();
                  } catch (err) {
                    // Ignore cleanup errors
                  }
                  reader = null;
                }
              }
            }, duration);
          }
        }
      } catch (err) {
        clearTimer();
        controller.error(err);
        if (reader) {
          try {
            await reader.cancel(err);
            reader.releaseLock();
          } catch (e) {
            // Ignore cleanup errors
          }
          reader = null;
        }
      }
    }

    return new ReadableStream<T>({
      start(controller) {
        reader = src.getReader();
        // Set up timeout for initial
        timer = setTimeout(() => {
          timer = null;
          if (!cancelled) {
            controller.error(new Error(`Stream timeout after ${duration}ms`));
            if (reader) {
              try {
                reader.cancel("timeout").catch(() => {}); // Handle promise properly
                reader.releaseLock();
              } catch (err) {
                // Ignore cleanup errors
              }
              reader = null;
            }
          }
        }, duration);

        return pull(controller);
      },
      pull(controller) {
        return pull(controller);
      },
      async cancel(reason?: any) {
        cancelled = true;
        clearTimer();
        if (reader) {
          try {
            await reader.cancel(reason);
            reader.releaseLock();
          } catch (err) {
            // Ignore cleanup errors
          } finally {
            reader = null;
          }
        }
      }
    }, { highWaterMark: opts?.highWaterMark ?? 16 });
  }
}