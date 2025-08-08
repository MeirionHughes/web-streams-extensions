/**
 * Catches errors from the source stream and switches to a fallback stream.
 * 
 * @template T The type of elements in the stream
 * @param selector Function that returns a fallback stream when an error occurs
 * @returns A stream operator that handles errors
 * 
 * @example
 * ```typescript
 * pipe(
 *   errorProneStream,
 *   catchError(err => from(['fallback', 'values']))
 * )
 * // If errorProneStream errors, switches to emit 'fallback', 'values'
 * ```
 */
export function catchError<T>(
  selector: (error: any, caught: ReadableStream<T>) => ReadableStream<T>
): (src: ReadableStream<T>, opts?: { highWaterMark?: number }) => ReadableStream<T> {
  return function (src: ReadableStream<T>, { highWaterMark = 16 } = {}) {
    let reader: ReadableStreamDefaultReader<T> = null;
    let fallbackReader: ReadableStreamDefaultReader<T> = null;
    let inFallback = false;

    async function flush(controller: ReadableStreamDefaultController<T>) {
      try {
        if (inFallback && fallbackReader) {
          // Read from fallback stream
          while (controller.desiredSize > 0 && fallbackReader != null) {
            let { done, value } = await fallbackReader.read();
            
            if (done) {
              controller.close();
              return;
            }

            controller.enqueue(value);
          }
        } else if (reader) {
          // Read from source stream
          while (controller.desiredSize > 0 && reader != null) {
            let { done, value } = await reader.read();
            
            if (done) {
              controller.close();
              return;
            }

            controller.enqueue(value);
          }
        }
      } catch (err) {
        if (!inFallback) {
          // Switch to fallback stream
          try {
            inFallback = true;
            if (reader) {
              reader.releaseLock();
              reader = null;
            }
            
            const fallbackStream = selector(err, src);
            fallbackReader = fallbackStream.getReader();
            
            // Continue flushing from fallback
            await flush(controller);
          } catch (fallbackErr) {
            controller.error(fallbackErr);
          }
        } else {
          // Error in fallback stream, propagate
          controller.error(err);
        }
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
        if (fallbackReader) {
          fallbackReader.releaseLock();
          fallbackReader = null;
        }
      }
    }, { highWaterMark });
  };
}
