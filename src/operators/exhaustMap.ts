import { from } from "../from.js";

/**
 * Maps each source value to a ReadableStream, Promise, or array, but ignores new values
 * while the current inner stream is still active. Only subscribes to a new inner stream
 * after the current one completes.
 * Similar to RxJS exhaustMap operator.
 * 
 * @template T The input type
 * @template R The output type of the inner streams
 * @param project A function that maps each source value to a ReadableStream, Promise, or array
 * @returns A stream operator that transforms and flattens values with exhaustion strategy
 * 
 * @example
 * ```typescript
 * // Handle rapid clicks - ignore subsequent clicks while processing
 * pipe(
 *   fromEvent(button, 'click'),
 *   exhaustMap(() => fetch('/api/data').then(r => r.json()))
 * )
 * // Only one request at a time, ignores clicks during ongoing request
 * 
 * // With arrays
 * pipe(
 *   from([1, 2, 3]),
 *   exhaustMap(n => [n, n * 10]) // Each maps to 2 values
 * )
 * // Might emit: 1, 10 (if 2 and 3 arrive while processing 1)
 * ```
 */
export interface ExhaustMapProjector<T, R> {
  (value: T, index: number): ReadableStream<R> | Promise<R> | ArrayLike<R>;
}

export function exhaustMap<T, R>(
  project: ExhaustMapProjector<T, R>
): (src: ReadableStream<T>, opts?: { highWaterMark?: number }) => ReadableStream<R> {
  return function (src: ReadableStream<T>, { highWaterMark = 16 } = {}) {
    let sourceReader: ReadableStreamDefaultReader<T> = null;
    let currentInnerReader: ReadableStreamDefaultReader<R> = null;
    let index = 0;
    let sourceDone = false;
    let isProcessingInner = false;

    async function flush(controller: ReadableStreamDefaultController<R>) {
      try {
        // Read from source and start new inner streams only if not currently processing one
        while (!sourceDone && !isProcessingInner && controller.desiredSize > 0 && sourceReader != null) {
          let { done, value } = await sourceReader.read();
          
          if (done) {
            sourceDone = true;
            break;
          }

          // Start new inner stream only if not currently processing
          if (!isProcessingInner) {
            isProcessingInner = true;
            const projected = await project(value, index++);
            
            // Convert to ReadableStream if needed
            let innerStream: ReadableStream<R>;
            if (projected instanceof ReadableStream) {
              innerStream = projected;
            } else if (Array.isArray(projected)) {
              innerStream = from(projected);
            } else {
              // Single value or Promise
              innerStream = from(projected as Promise<R>);
            }
            
            currentInnerReader = innerStream.getReader();
          }
          // If we're processing an inner stream, ignore this source value
        }

        // Read from current inner stream
        while (controller.desiredSize > 0 && currentInnerReader != null) {
          let { done, value } = await currentInnerReader.read();
          
          if (done) {
            currentInnerReader = null;
            isProcessingInner = false;
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
