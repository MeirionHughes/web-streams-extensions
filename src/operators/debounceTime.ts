// Reverted to setTimeout for testing with Chrome anti-throttling flags

/**
 * Emits a notification from the source stream only after a particular time span has passed without another source emission.
 * 
 * Like delay, but passes only the most recent value from each burst of emissions.
 * debounceTime delays values emitted by the source stream, but drops previous pending delayed emissions 
 * if a new value arrives on the source stream. This operator keeps track of the most recent value from 
 * the source stream, and emits that only when dueTime has passed without any other value appearing on 
 * the source stream.
 * 
 * @template T The type of elements in the stream
 * @param duration Duration in milliseconds to wait for silence before emitting the most recent value
 * @returns A stream operator that debounces values
 * 
 * @example
 * ```typescript
 * // Emit the most recent value after 1 second of silence
 * let stream = pipe(
 *   from(rapidValueStream),
 *   debounceTime(1000)
 * );
 * ```
 */
export function debounceTime<T>(duration: number): (src: ReadableStream<T>, opts?: { highWaterMark?: number }) => ReadableStream<T> {
  if (duration <= 0) {
    throw new Error("Debounce duration must be positive");
  }

  return function (src: ReadableStream<T>, opts?: { highWaterMark?: number }) {
    let reader: ReadableStreamDefaultReader<T> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastValue: T | undefined = undefined;
    let hasValue = false;
    let cancelled = false;

    function clearTimer() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }

    async function pull(controller: ReadableStreamDefaultController<T>) {
      try {
        while (controller.desiredSize > 0 && reader != null && !cancelled) {
          let next = await reader.read();
          if (next.done) {
            clearTimer();
            // Emit final value if we have one
            if (hasValue && !cancelled) {
              try {
                controller.enqueue(lastValue!);
              } catch (err) {
                // Controller might be closed, ignore
              }
            }
            controller.close();
            reader.releaseLock();
            reader = null;
            return;
          } else {
            // Store the latest value
            lastValue = next.value;
            hasValue = true;

            // Clear existing timer and set new one
            clearTimer();
            
            timer = setTimeout(() => {
              timer = null;
              if (!cancelled && hasValue) {
                try {
                  controller.enqueue(lastValue!);
                  hasValue = false;
                } catch (err) {
                  // Controller might be closed, ignore
                }
                
                // If reader is done, close the stream
                if (reader == null) {
                  try {
                    controller.close();
                  } catch (err) {
                    // Controller might already be closed
                  }
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
        return pull(controller);
      },
      pull(controller) {
        return pull(controller);
      },
      cancel(reason?: any) {
        cancelled = true;
        clearTimer();
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
      }
    }, { highWaterMark: opts?.highWaterMark ?? 16 });
  }
}