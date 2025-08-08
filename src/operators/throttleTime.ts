/**
 * Limits the rate of emissions to at most one per specified time period.
 * The first value is emitted immediately, then subsequent values are ignored until the time period expires.
 * 
 * @template T The type of elements in the stream
 * @param duration The minimum time between emissions in milliseconds
 * @returns A stream operator that throttles emissions
 * 
 * @example
 * ```typescript
 * pipe(
 *   interval(100), // Emits every 100ms
 *   throttleTime(300) // Only emit every 300ms
 * )
 * // Will emit values at 0ms, 300ms, 600ms, etc.
 * ```
 */
export function throttleTime<T>(
  duration: number
): (src: ReadableStream<T>, opts?: { highWaterMark?: number }) => ReadableStream<T> {
  return function (src: ReadableStream<T>, { highWaterMark = 16 } = {}) {
    let reader: ReadableStreamDefaultReader<T> = null;
    let lastEmitTime = 0;
    let pendingValue: T | undefined;
    let hasPendingValue = false;

    function cleanup() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      if (reader) {
        reader.releaseLock();
        reader = null;
      }
    }

    async function flush(controller: ReadableStreamDefaultController<T>) {
      try {
        const now = Date.now();

        // Emit pending value if enough time has passed
        if (hasPendingValue && (now - lastEmitTime) >= duration) {
          if (controller.desiredSize > 0) {
            controller.enqueue(pendingValue!);
            lastEmitTime = now;
            hasPendingValue = false;
          }
        }

        while (controller.desiredSize > 0 && reader != null) {
          let { done, value } = await reader.read();
          
          if (done) {
            // Emit any final pending value
            if (hasPendingValue && controller.desiredSize > 0) {
              controller.enqueue(pendingValue!);
            }
            cleanup(); // Clean up before closing
            controller.close();
            return;
          }

          const currentTime = Date.now();
          
          if (lastEmitTime === 0 || (currentTime - lastEmitTime) >= duration) {
            // Can emit immediately
            controller.enqueue(value);
            lastEmitTime = currentTime;
            hasPendingValue = false;
          } else {
            // Store as pending value (replaces previous pending)
            pendingValue = value;
            hasPendingValue = true;
          }
        }
      } catch (err) {
        cleanup(); // Clean up on error
        controller.error(err);
      }
    }

    // Set up periodic emission of pending values
    let intervalId: NodeJS.Timeout | number | null = null;

    return new ReadableStream<T>({
      async start(controller) {
        reader = src.getReader();
        
        // Periodically check for pending values to emit
        intervalId = setInterval(async () => {
          if (hasPendingValue && controller.desiredSize > 0) {
            const now = Date.now();
            if ((now - lastEmitTime) >= duration) {
              try {
                controller.enqueue(pendingValue!);
                lastEmitTime = now;
                hasPendingValue = false;
              } catch (err) {
                // Controller might be closed, ignore
              }
            }
          }
        }, Math.min(duration / 4, 50)); // Check frequently but not too frequently

        await flush(controller);
      },
      async pull(controller) {
        await flush(controller);
      },
      cancel() {
        cleanup();
      }
    }, { highWaterMark });
  };
}
