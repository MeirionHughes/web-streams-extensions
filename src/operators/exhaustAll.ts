import { from } from "../from.js";

/**
 * Flattens a stream of streams by dropping new inner streams while the current one is still active.
 * Similar to RxJS exhaustAll operator.
 * 
 * Each time a new inner stream arrives, if there's no currently active inner stream,
 * it subscribes to it. If there is already an active inner stream, the new one is ignored.
 * Only when the current inner stream completes will exhaustAll consider subscribing to the next one.
 * 
 * @template T The type of values emitted by the inner streams
 * @returns A stream operator that flattens with exhaust strategy
 * 
 * @example
 * ```typescript
 * // Handle rapid events but ignore new ones while processing
 * pipe(
 *   from([
 *     from([1, 2]),      // Will be processed
 *     from([3, 4]),      // Will be ignored if first is still active
 *     from([5, 6])       // Will be ignored if any previous is still active
 *   ]),
 *   exhaustAll()
 * )
 * // Result: [1, 2] (3, 4, 5, 6 are ignored)
 * 
 * // Real-world example: click handling with debouncing
 * pipe(
 *   buttonClicks,
 *   map(() => timer(1000).pipe(map(() => 'Action completed'))),
 *   exhaustAll()
 * )
 * // Ignores rapid clicks - only first click triggers action
 * ```
 */

export function exhaustAll<T>(): (src: ReadableStream<ReadableStream<T> | Promise<T> | Iterable<T> | AsyncIterable<T>>, opts?: { highWaterMark?: number }) => ReadableStream<T> {
  return function (src: ReadableStream<ReadableStream<T> | Promise<T> | Iterable<T> | AsyncIterable<T>>, { highWaterMark = 16 } = {}) {
    let cancelled = false;
    
    return new ReadableStream<T>({
      async start(controller) {
        const sourceReader = src.getReader();
        let currentInnerReader: ReadableStreamDefaultReader<T> | null = null;
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

              // Convert value to stream using from() helper
              let innerStream: ReadableStream<T>;
              if (value instanceof ReadableStream) {
                innerStream = value;
              } else {
                // Use from() to handle Promise<T>, Iterable<T>, or AsyncIterable<T>
                innerStream = from(value);
              }

              // if there's no active inner stream
              if (!isProcessingInner) {
                // trigger a worker to consume the new inner stream and set state
                isProcessingInner = true;
                currentInnerReader = innerStream.getReader();
                
                // Start the inner stream worker
                processInnerStream().catch(err => {
                  if (!cancelled) {
                    controller.error(err);
                  }
                });
              }
              // else ignore the new inner stream (exhaust behavior)
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
      }
    }, { highWaterMark });
  };
}
