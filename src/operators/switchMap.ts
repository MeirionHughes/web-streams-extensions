/**
 * Maps each source value to a stream and flattens them, but only the most recent inner stream.
 * When a new inner stream is created, the previous one is cancelled.
 * 
 * @template T The input type
 * @template R The output type
 * @param project Function that maps values to streams
 * @returns A stream operator that switches to new streams
 * 
 * @example
 * ```typescript
 * pipe(
 *   from([1, 2, 3]),
 *   switchMap(x => from([x * 10, x * 100]))
 * )
 * // If values come quickly, might emit: 10, 100, 20, 200, 30, 300
 * // But if 2 comes before 1's inner stream completes, 1's stream is cancelled
 * ```
 */
export function switchMap<T, R>(
  project: (value: T, index: number) => ReadableStream<R> | Promise<ReadableStream<R>>
): (src: ReadableStream<T>, opts?: { highWaterMark?: number }) => ReadableStream<R> {
  return function (src: ReadableStream<T>, { highWaterMark = 16 } = {}) {
    let sourceReader: ReadableStreamDefaultReader<T> = null;
    let currentInnerReader: ReadableStreamDefaultReader<R> = null;
    let index = 0;
    let sourceDone = false;

    async function flush(controller: ReadableStreamDefaultController<R>) {
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
          const innerStream = await project(value, index++);
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

    return new ReadableStream<R>({
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
