import { from } from "../from.js";

export function concatAll<T>(): (src: ReadableStream<ReadableStream<T> | Promise<T> | Iterable<T> | AsyncIterable<T>>, opts?: { highWaterMark?: number }) => ReadableStream<T> {
  return function (src: ReadableStream<ReadableStream<T> | Promise<T> | Iterable<T> | AsyncIterable<T>>, opts?: { highWaterMark?: number }) {
    let readerSrc: ReadableStreamDefaultReader<ReadableStream<T> | Promise<T> | Iterable<T> | AsyncIterable<T>> = null;
    let reader: ReadableStreamDefaultReader<T> = null;
    let pendingValue: T | null = null;
    let outerDone = false;
    let flushing = false;

    async function flush(controller: ReadableStreamDefaultController<T>) {
      if (flushing) {
        // Already flushing, avoid concurrent execution
        return;
      }
      flushing = true;

      try {
        while (true) {
          // First, handle any pending value from previous call
          if (pendingValue !== null) {
            if (controller.desiredSize > 0) {
              controller.enqueue(pendingValue);
              pendingValue = null;
            } else {
              // Still no space, stop and wait for next pull
              return;
            }
          }

          // Process current reader if we have one
          if (reader != null) {
            let next = await reader.read();
            if (next.done) {
              // Current inner stream is exhausted, clean up
              if (reader) {
                reader.releaseLock();
              }
              reader = null;
              // Continue the loop to get next source or close if outer is done
            } else {
              // We have a value from inner stream
              if (controller.desiredSize > 0) {
                controller.enqueue(next.value);
              } else {
                // No space, save value for next pull
                pendingValue = next.value;
                return;
              }
            }
          }

          // If we don't have a current inner stream reader, get the next one
          if (reader == null) {
            if (!outerDone) {
              let next = await readerSrc.read();
              if (next.done) {
                outerDone = true;
                // No more inner streams and current reader is done, we're finished
                controller.close();
                return;
              } else {
                let value = next.value;
                
                // Convert value to stream using from() helper
                let innerStream: ReadableStream<T>;
                if (value instanceof ReadableStream) {
                  innerStream = value;
                } else {
                  // Use from() to handle Promise<T>, Iterable<T>, or AsyncIterable<T>
                  innerStream = from(value);
                }
                
                reader = innerStream.getReader();
              }
            } else {
              // Outer is done and no current inner stream, so we're completely done
              controller.close();
              return;
            }
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        flushing = false;
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
          await readerSrc.cancel(reason);
          readerSrc.releaseLock();
          readerSrc = null;
        }
        if (reader) {
          await reader.cancel(reason);
          reader.releaseLock();
          reader = null;
        }
        pendingValue = null;
      }
    }, { highWaterMark: opts?.highWaterMark ?? 16 });
  }
}

