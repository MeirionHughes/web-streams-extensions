import { from } from "../from.js";
import { pipe } from "../pipe.js";
import { map } from "./map.js";

/**
 * Maps each source value to a ReadableStream, Promise, or array, but ignores new values
 * while the current inner stream is still active. Only subscribes to a new inner stream
 * after the current one completes.
 * Similar to RxJS exhaustMap operator.
 * 
 * @template T The input type
 * @template R The output type of the inner streams
 * @param project A function that maps each source value to a ReadableStream, Promise, or array.
 *                Receives (value, index, signal) where signal is an AbortSignal that will be 
 *                aborted when this projection is cancelled
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
 * 
 * // HTTP requests with proper cancellation
 * pipe(
 *   buttonClicks,
 *   exhaustMap((event, index, signal) => 
 *     fetch('/api/action', { signal }).then(r => r.json()).then(data => from([data]))
 *   )
 * )
 * // Ignores rapid clicks, cancels requests on stream cancel
 * ```
 */
export interface ExhaustMapProjector<T, R> {
  (value: T, index: number, signal?: AbortSignal): ReadableStream<R> | Promise<R> | Iterable<R> | AsyncIterable<R>;
}

export function exhaustMap<T, R>(projector: ExhaustMapProjector<T, R>): (src: ReadableStream<T>, strategy?: QueuingStrategy<R>) => ReadableStream<R> {
  return function (src: ReadableStream<T>, strategy: QueuingStrategy<R> = { highWaterMark: 16 }) {
    let cancelled = false;
    let index = 0;
    let currentAbortController: AbortController | null = null;

    return new ReadableStream<R>({
      async start(controller) {
        const sourceReader = src.getReader();
        let currentInnerReader: ReadableStreamDefaultReader<R> | null = null;
        let sourceDone = false;
        let isProcessingInner = false;

        // Source reader: reads from src without any blocks
        const readFromSource = async () => {
          try {
            while (!cancelled && !sourceDone) {
              const { done, value } = await sourceReader.read();
              
              if (done) {
                sourceDone = true;
                // If no inner stream is processing, complete immediately
                if (!isProcessingInner) {
                  controller.close();
                }
                break;
              }

              // if there's no active inner stream
              if (!isProcessingInner) {
                // Create AbortController for this projection
                currentAbortController = new AbortController();
                
                // Apply projector to get inner stream (increment index only when projecting)
                const projected = projector(value, index++, currentAbortController.signal);
                
                // Convert projected result to stream
                let innerStream: ReadableStream<R>;
                if (projected instanceof ReadableStream) {
                  innerStream = projected;
                } else {
                  // Use from() to handle Promise<R>, Iterable<R>, or AsyncIterable<R>
                  innerStream = from(projected);
                }

                // trigger a worker to consume the new inner stream and set state
                isProcessingInner = true;
                currentInnerReader = innerStream.getReader();
                
                // Start the inner stream worker
                processInnerStream().catch(err => {
                  if (!cancelled) {
                    controller.error(err);
                  }
                });
              } else {
                // Exhaust behavior: ignore new values while processing inner stream
                // If the value is a ReadableStream, cancel it to prevent resource leaks
                if (value && typeof value === 'object' && 'getReader' in value && typeof value.getReader === 'function') {
                  try {
                    const reader = (value as unknown as ReadableStream<any>).getReader();
                    await reader.cancel().catch(() => {}); // Ignore cancellation errors
                    reader.releaseLock();
                  } catch {
                    // Ignore errors during cleanup
                  }
                }
                // Don't increment index for ignored values - they are not projected at all
              }
            }
          } catch (err) {
            if (!cancelled) {
              controller.error(err);
            }
          } finally {
            try {
              sourceReader.releaseLock();
            } catch {}
          }
        };

        // Inner stream worker: processes the active inner stream
        const processInnerStream = async () => {
          try {
            while (!cancelled && currentInnerReader) {
              const { done: innerDone, value: innerValue } = await currentInnerReader.read();
              
              if (innerDone) {
                // Inner stream completed
                try {
                  currentInnerReader.releaseLock();
                } catch {}
                currentInnerReader = null;
                isProcessingInner = false;
                
                // Clean up abort controller
                if (currentAbortController) {
                  currentAbortController = null;
                }
                
                // Check if we should complete
                if (sourceDone) {
                  controller.close();
                } else {
                  // Continue reading from source for next inner stream
                  readFromSource().catch(err => {
                    if (!cancelled) {
                      controller.error(err);
                    }
                  });
                }
                return;
              }
              
              // Emit value from inner stream
              controller.enqueue(innerValue);
            }
          } catch (err) {
            // Error in inner stream
            try {
              if (currentInnerReader) {
                currentInnerReader.releaseLock();
              }
            } catch {}
            currentInnerReader = null;
            isProcessingInner = false;
            
            // Clean up abort controller
            if (currentAbortController) {
              currentAbortController = null;
            }
            
            // Propagate the error to the controller
            if (!cancelled) {
              controller.error(err);
            }
          }
        };

        // Start reading from source
        readFromSource().catch(err => {
          if (!cancelled) {
            controller.error(err);
          }
        });
      },

      cancel() {
        cancelled = true;
        
        // Abort any ongoing projection
        if (currentAbortController) {
          currentAbortController.abort();
        }
      }
    }, strategy);
  };
}
