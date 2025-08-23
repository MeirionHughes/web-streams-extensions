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
): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T> {
  return function (src: ReadableStream<T>, strategy: QueuingStrategy<T> = { highWaterMark: 16 }) {
    let reader: ReadableStreamDefaultReader<T> = null;
    let fallbackReader: ReadableStreamDefaultReader<T> = null;
    let inFallback = false;
    let reading = false; // Prevent concurrent reads


    async function flush(controller: ReadableStreamDefaultController<T>) {
      //console.log('[catchError] flush() start', { desiredSize: controller.desiredSize, inFallback, hasReader: !!reader });
      if (reading) {
        //console.log('[catchError] already reading, returning early');
        return;
      }
      reading = true;
      try {
        while (controller.desiredSize > 0 && reader != null) {
          //console.log('[catchError] loop start', { desiredSize: controller.desiredSize });
          let next = await reader.read();
          //console.log('[catchError] read completed', { done: next.done });
          if (next.done) {
            //console.log('[catchError] source signaled done, closing controller');
            controller.close();
            src = null;
            if (reader) {
              try {
                //console.log('[catchError] releasing reader lock after done');
                reader.releaseLock();
              } catch (e) {
                //console.log('[catchError] error releasing reader lock after done', e);
              }
              reader = null;
            }
            // exit loop since source is finished
            break;
          } else {
            //console.log('[catchError] enqueueing value', next.value);
            controller.enqueue(next.value);
          }
        }

        if (controller.desiredSize <= 0) {
          //console.log('[catchError] exiting flush loop because desiredSize <= 0', { desiredSize: controller.desiredSize });
        } else if (reader == null) {
          //console.log('[catchError] exiting flush loop because reader is null');
        }
      } catch (err) {
        //console.log('[catchError] caught error while reading', err);
        if (reader) {
          try {
           //console.log('[catchError] cancelling reader due to error');
            // try to cancel the reader with the error and release lock
            await reader.cancel(err);
            try {
              //console.log('[catchError] releasing reader lock after cancel');
              reader.releaseLock();
            } catch (e) {
              //console.log('[catchError] error releasing reader lock after cancel', e);
            }
          } catch (e) {
            //console.log('[catchError] error during reader cleanup', e);
            // Ignore cleanup errors
          }
          reader = null;
        }

        if (inFallback) {
          //console.log('[catchError] already in fallback, forwarding error to controller.error');
          controller.error(err);
        } else {
          //console.log('[catchError] switching to fallback via selector');
          try {
            src = selector(err, src);
            //console.log('[catchError] selector returned', !!src);
          } catch (selErr) {
            //console.log('[catchError] selector threw error', selErr);
            controller.error(selErr);
            return;
          }
          if (src) {
            inFallback = true;
            try {
              //console.log('[catchError] obtaining reader from fallback stream');
              reader = src.getReader();
            } catch (e) {
              //console.log('[catchError] error getting reader from fallback stream', e);
              controller.error(e);
            }
          } else {
            //console.log('[catchError] selector returned falsy stream, closing controller');
            controller.close();
          }
        }
      } finally {
        reading = false;
        //console.log('[catchError] flush() end', { reading, inFallback, hasReader: !!reader, desiredSize: controller.desiredSize });
      }
    }


    return new ReadableStream<T>({
      async start(controller) {
        reader = src.getReader();
        await flush(controller);
      },
      async pull(controller) {
        //console.log('[catchError] ReadableStream pull() called');
        await flush(controller);
      },
      cancel() {
        //console.log('[catchError] ReadableStream cancel() called');
        if (reader) {
          reader.releaseLock();
          reader = null;
        }
        if (fallbackReader) {
          fallbackReader.releaseLock();
          fallbackReader = null;
        }
      }
    }, strategy);
  };
}
