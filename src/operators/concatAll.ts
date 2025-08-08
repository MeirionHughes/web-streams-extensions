import { isReadableStream } from "../utils/is-readable.js";

export function concatAll<T>(): (src: ReadableStream<ReadableStream<T> | Promise<T> | ArrayLike<T>>, opts?: { highWaterMark?: number }) => ReadableStream<T> {
  return function (src: ReadableStream<ReadableStream<T>>, opts?: { highWaterMark?: number }) {
    let readerSrc: ReadableStreamDefaultReader<ReadableStream<T> | Promise<T>> = null;
    let reader: ReadableStreamDefaultReader<T> = null;

    async function flush(controller: ReadableStreamDefaultController<T>) {
      try {
        while (controller.desiredSize > 0) {
          if (reader == null) {
            let next = await readerSrc.read();
            if (next.done) {
              controller.close();
              return;
            } else {
              let src = await next.value;
              if (Array.isArray(src)) {
                for (let item of src) {
                  controller.enqueue(item);
                }
                // Continue the loop to get next item if we still need more
                continue;
              } else if (isReadableStream(src)) {
                reader = src.getReader();
              } else {
                controller.enqueue(src);
                return;
              }
            }
          }

          // Process current reader if we have one
          if (reader != null) {
            let next = await reader.read();
            // if the current reader is exhausted... 
            if (next.done) {
              reader = null;
              // Continue the loop to get next source
            } else {
              controller.enqueue(next.value);
            }
          }
        }
      } catch (err) {
        controller.error(err);
      }
    }

    return new ReadableStream<T>({
      async start(controller) {
        readerSrc = src.getReader();
        return flush(controller);
      },
      async pull(controller) {
        return flush(controller);
      },
      async cancel(reason?: any) {
        if (readerSrc) {
          readerSrc.cancel(reason);
          readerSrc.releaseLock();
          readerSrc = null;
        }
        if (reader) {
          reader.cancel(reason);
          reader.releaseLock();
          reader = null;
        }
      }
    }, { highWaterMark: opts?.highWaterMark ?? 16 });
  }
}

