/**
 * buffer elements until a duration of time has past since the last chunk.
 * @param count elements to buffer before enqueue
 */
export function debounceTime<T>(duration: number, highWaterMark = 16): (src: ReadableStream<T>) => ReadableStream<T[]> {
  return function (src: ReadableStream<T>) {
    let reader: ReadableStreamDefaultReader<T> = null;
    let buffer = [];
    let timer = null;
    let cancelled = false;

    async function pull(controller: ReadableStreamDefaultController<T[]>) {
      try {
        while (reader != null) {
          let next = await reader.read();
          if (next.done) {
            if (timer == null) {
              controller.close();
            }
            reader = null;
          } else {
            buffer.push(next.value);

            if (timer != null) {
              clearTimeout(timer);
            }

            timer = setTimeout(() => {
              timer = null;
              if (cancelled !== true) {
                controller.enqueue(buffer);

                if (reader == null) {
                  controller.close();
                }
              }

              buffer = [];
            }, duration);
          }
        }
      } catch (err) {
        controller.error(err);
        reader.cancel(err);
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
        if (reader) {
          reader.cancel(reason);
          reader.releaseLock();
          reader = null;
        }
        cancelled = true;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      }
    }, { highWaterMark });
  }
}