import { from } from "../from.js";
import { pipe } from "../pipe.js";
import { BlockingQueue, Gate } from "../utils/signal.js";
import { map } from "./map.js";
import { mapSync } from "./mapSync.js";
import { schedule } from "./schedule.js";
import { on } from "./on.js";
import { SubscriptionLike } from "../_subscription.js";
import { toPromise } from "../to-promise.js";
import { toArray } from "../to-array.js";

/**
 * Merges a stream of streams into a single flattened stream, with optional concurrency control.
 * Each inner stream is subscribed to and their values are merged into the output stream.
 * The operator completes when all inner streams complete.
 * 
 * @template T The type of values in the inner streams
 * @param concurrent Maximum number of inner streams to process simultaneously (default: Infinity)
 * @returns A transform function that flattens streams with concurrency control
 * 
 * @example
 * ```typescript
 * // Merge with limited concurrency
 * from([
 *   from([1, 2, 3]),
 *   from([4, 5, 6]),
 *   Promise.resolve(7)
 * ])
 * .pipe(
 *   merge(2) // Process max 2 streams at once
 * )
 * // Emits: values from all streams as they arrive
 * ```
 */
export function merge<T>(
  concurrent: number = Infinity
): (src: ReadableStream<ReadableStream<T> | Promise<T>>) => ReadableStream<T> {
  if (concurrent <= 0) {
    throw new Error("Concurrency limit must be greater than zero");
  }

  return function (
    src: ReadableStream<ReadableStream<T> | Promise<T>>
  ): ReadableStream<T> {
    let outerGate = new Gate(concurrent);
    let innerQueue = new BlockingQueue<ReadableStreamReadResult<T>>();
    let subscription: SubscriptionLike | null = null;
    let errored: any = null;

    return new ReadableStream({
      start(outerController) {
        let reading: ReadableStream<T>[] = [];
        let readingDone = false;

        toPromise(
          pipe(
            src,
            schedule({
              nextTick: async () => {
                await outerGate.wait();
              },
            }),
            map((innerStreamOrPromise) => {
              // Wrap Promises as Streams
              let readableStream: ReadableStream<T>;
              if (!(innerStreamOrPromise instanceof ReadableStream)) {
                readableStream = from(innerStreamOrPromise as Promise<T>);
              } else {
                readableStream = innerStreamOrPromise;
              }

              reading.push(readableStream);

              pipe(
                readableStream,
                map(async (value) => {
                  try {
                    await innerQueue.push({ done: false, value });
                  } catch (err) {
                    outerController.error(err);
                  }
                }),
                // Track completion lifecycle to manage concurrent streams
                on({
                  error(err) {
                    errored = err;
                    outerController.error(err);
                  },
                  complete() {
                    outerGate.increment();
                    const index = reading.indexOf(readableStream);
                    if (index !== -1) {
                      reading.splice(index, 1);
                    }
                    if (reading.length === 0 && readingDone) {
                      try {
                        innerQueue.push({ done: true, value: undefined as any });
                      } catch (err) {
                        outerController.error(err);
                      }
                    }
                  },
                })
              );
            }),
            on({
              error(err) {
                errored = err;
                outerController.error(err);
              },
              complete() {
                readingDone = true;
                if (reading.length === 0) {
                  try {
                    innerQueue.push({ done: true, value: undefined as any });
                  } catch (err) {
                    outerController.error(err);
                  }
                }
              }
            })
          )
        ).catch((err) => {
          errored = err;
          outerController.error(err);
        });
      },
      async pull(controller) {
        try {
          while (controller.desiredSize > 0 && !errored) {
            const next = await innerQueue.pull();
            if (errored) {
              controller.error(errored);
              return;
            }
            if (next.done) {
              controller.close();
              return;
            } else {
              controller.enqueue(next.value);
            }
          }
        } catch (err) {
          controller.error(err);
        }
      },
      cancel(reason?: any) {
        if (subscription) {
          try {
            subscription.unsubscribe();
          } catch (err) {
            // Ignore cleanup errors
          } finally {
            subscription = null;
          }
        }
      },
    });
  };
}
