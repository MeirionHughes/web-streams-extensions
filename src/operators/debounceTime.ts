/**
 * Buffers elements until a duration of time has passed since the last chunk.
 * Only emits the buffered elements after the specified duration of silence.
 * Useful for batching rapid sequences of values.
 * 
 * @template T The type of elements to buffer
 * @param duration Duration in milliseconds to wait after the last chunk
 * @returns A stream operator that debounces elements by time
 * 
 * @example
 * ```typescript
 * let stream = pipe(
 *   from(rapidValueStream),
 *   debounceTime(1000) // Wait 1 second after last value
 * );
 * ```
 */
export function debounceTime<T>(duration: number): (src: ReadableStream<T>, opts?: { highWaterMark?: number }) => ReadableStream<T[]> {
  if (duration <= 0) {
    throw new Error("Debounce duration must be positive");
  }
  
  return function (src: ReadableStream<T>, opts?: { highWaterMark?: number }) {
    let reader: ReadableStreamDefaultReader<T> = null;
    let buffer: T[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    function clearTimer() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }

    function emitBuffer(controller: ReadableStreamDefaultController<T[]>) {
      if (buffer.length > 0 && !cancelled) {
        try {
          controller.enqueue(buffer);
          buffer = [];
        } catch (err) {
          // Controller might be closed, ignore
        }
      }
    }

    async function pull(controller: ReadableStreamDefaultController<T[]>) {
      try {
        while (reader != null && !cancelled) {
          let next = await reader.read();
          if (next.done) {
            clearTimer();
            // Emit final buffer if it has elements
            emitBuffer(controller);
            controller.close();
            reader.releaseLock();
            reader = null;
            return;
          } else {
            buffer.push(next.value);

            // Clear existing timer and set new one
            clearTimer();
            timer = setTimeout(() => {
              timer = null;
              if (!cancelled) {
                emitBuffer(controller);
                
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
            reader.cancel(err);
            reader.releaseLock();
          } catch (e) {
            // Ignore cleanup errors
          }
          reader = null;
        }
      }
    }

    return new ReadableStream<T[]>({
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
            reader.cancel(reason);
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