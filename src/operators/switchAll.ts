/**
 * Flattens a higher-order ReadableStream by switching to the latest inner stream.
 * When a new inner stream arrives, the previous inner stream is cancelled and
 * the new one is subscribed to. Only the most recent inner stream emits values.
 * 
 * @template T The type of values emitted by the inner streams
 * @returns A stream operator that flattens streams by switching to the latest
 * 
 * @example
 * ```typescript
 * // Switch to latest stream
 * pipe(
 *   from([
 *     timer(100).pipe(map(() => 'first')),
 *     timer(50).pipe(map(() => 'second')),
 *     timer(25).pipe(map(() => 'third'))
 *   ]),
 *   switchAll()
 * )
 * // Likely emits: 'third' (if streams arrive quickly, earlier ones are cancelled)
 * 
 * // Search suggestions - cancel previous search when new query arrives
 * pipe(
 *   searchQueries,
 *   map(query => fetch(`/api/search?q=${query}`)),
 *   switchAll()
 * )
 * // Only the latest search request will complete
 * ```
 */
export function switchAll<T>(): (
  src: ReadableStream<ReadableStream<T> | Promise<ReadableStream<T>>>, 
  opts?: { highWaterMark?: number }
) => ReadableStream<T> {
  return function (src: ReadableStream<ReadableStream<T> | Promise<ReadableStream<T>>>, { highWaterMark = 16 } = {}) {
    let sourceReader: ReadableStreamDefaultReader<ReadableStream<T> | Promise<ReadableStream<T>>> = null;
    let currentInnerReader: ReadableStreamDefaultReader<T> = null;
    let sourceDone = false;

    async function flush(controller: ReadableStreamDefaultController<T>) {
      try {
        // Read from source and switch to new inner streams
        while (!sourceDone && controller.desiredSize > 0 && sourceReader != null) {
          let { done, value } = await sourceReader.read();
          
          if (done) {
            sourceDone = true;
            break;
          }

          // Cancel previous inner stream
          if (currentInnerReader) {
            try {
              await currentInnerReader.cancel();
            } catch (err) {
              // Ignore cancellation errors
            }
            currentInnerReader = null;
          }

          // Create new inner stream
          const innerStream = await value;
          currentInnerReader = innerStream.getReader();
        }

        // Read from current inner stream
        while (controller.desiredSize > 0 && currentInnerReader != null) {
          let { done, value } = await currentInnerReader.read();
          
          if (done) {
            currentInnerReader = null;
            break;
          }

          controller.enqueue(value);
        }

        // If source is done and no inner reader, close
        if (sourceDone && !currentInnerReader) {
          controller.close();
        }
      } catch (err) {
        controller.error(err);
      }
    }

    return new ReadableStream<T>({
      async start(controller) {
        sourceReader = src.getReader();
        await flush(controller);
      },
      async pull(controller) {
        await flush(controller);
      },
      cancel() {
        if (sourceReader) {
          sourceReader.releaseLock();
          sourceReader = null;
        }
        if (currentInnerReader) {
          currentInnerReader.cancel();
          currentInnerReader = null;
        }
      }
    }, { highWaterMark });
  };
}
