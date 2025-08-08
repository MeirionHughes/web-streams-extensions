/**
 * Delays the emission of values by a specified amount of time.
 * Each value is delayed by the same duration.
 * 
 * @param duration The delay in milliseconds
 * @returns A stream operator that delays emissions
 * 
 * @example
 * ```typescript
 * pipe(
 *   from([1, 2, 3]),
 *   delay(1000)
 * )
 * // Each value is delayed by 1 second from its original emission time
 * 
 * // Useful for animations or rate limiting
 * pipe(
 *   userClicks,
 *   delay(200) // 200ms delay for debounce-like behavior
 * )
 * ```
 */
export function delay<T>(duration: number): (
  src: ReadableStream<T>, 
  opts?: { highWaterMark?: number }
) => ReadableStream<T> {
  if (duration < 0) {
    throw new Error("Delay duration must be non-negative");
  }

  return function (src: ReadableStream<T>, { highWaterMark = 16 } = {}) {
    let reader: ReadableStreamDefaultReader<T> = null;
    let pendingTimeouts = new Set<ReturnType<typeof setTimeout>>();

    async function flush(controller: ReadableStreamDefaultController<T>) {
      try {
        while (controller.desiredSize > 0 && reader != null) {
          let { done, value } = await reader.read();
          
          if (done) {
            // Wait for all pending timeouts to complete before closing
            if (pendingTimeouts.size === 0) {
              controller.close();
            }
            return;
          }

          // Schedule delayed emission
          const timeoutId = setTimeout(() => {
            try {
              pendingTimeouts.delete(timeoutId);
              controller.enqueue(value);
              
              // If reader is null (stream ended) and no more pending timeouts, close
              if (!reader && pendingTimeouts.size === 0) {
                controller.close();
              }
            } catch (err) {
              // Controller might be closed, just clean up
              pendingTimeouts.delete(timeoutId);
            }
          }, duration);
          
          pendingTimeouts.add(timeoutId);
        }
      } catch (err) {
        controller.error(err);
      }
    }

    return new ReadableStream<T>({
      async start(controller) {
        reader = src.getReader();
        await flush(controller);
      },
      async pull(controller) {
        await flush(controller);
      },
      cancel() {
        if (reader) {
          reader.releaseLock();
          reader = null;
        }
        
        // Clear all pending timeouts
        for (const timeoutId of pendingTimeouts) {
          clearTimeout(timeoutId);
        }
        pendingTimeouts.clear();
      }
    }, { highWaterMark });
  };
}
