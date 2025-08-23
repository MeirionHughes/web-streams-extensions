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
 * Flattens a higher-order ReadableStream by merging inner streams concurrently.
 * Subscribes to all inner streams simultaneously and emits values as they arrive.
 * Order of emissions is not guaranteed.
 * 
 * @template T The type of values emitted by the inner streams
 * @param concurrent Maximum number of inner streams to process simultaneously (default: Infinity)
 * @returns A stream operator that flattens streams concurrently
 * 
 * @example
 * ```typescript
 * // Flatten arrays of streams with unlimited concurrency
 * pipe(
 *   from([
 *     from([1, 2, 3]),
 *     from([4, 5, 6]),
 *     from([7, 8, 9])
 *   ]),
 *   mergeAll()
 * )
 * // Emits: values in any order as they arrive
 * 
 * // With limited concurrency
 * pipe(
 *   from([
 *     fetch('/api/1'),
 *     fetch('/api/2'),
 *     fetch('/api/3'),
 *     fetch('/api/4')
 *   ]),
 *   mergeAll(2) // Only 2 concurrent requests
 * )
 * ```
 */
export function mergeAll<T>(
  concurrent: number = Infinity
): (src: ReadableStream<ReadableStream<T> | Promise<T> | Iterable<T> | AsyncIterable<T>>, strategy?:QueuingStrategy<T>) => ReadableStream<T> {
  if (concurrent <= 0) {
    throw new Error("Concurrency limit must be greater than zero");
  }

  return function (
    src: ReadableStream<ReadableStream<T> | Promise<T> | Iterable<T> | AsyncIterable<T>>, strategy: QueuingStrategy<T> = {highWaterMark: 16}
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
              schedule: (callback) => {
                outerGate.wait().then(callback);
              },
            }),
            map((innerStreamOrPromise) => {
              // Wrap non-ReadableStreams as Streams using from()
              let readableStream: ReadableStream<T>;
              if (!(innerStreamOrPromise instanceof ReadableStream)) {
                readableStream = from(innerStreamOrPromise as Promise<T> | Iterable<T> | AsyncIterable<T>);
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
    }, strategy);
  };
}
