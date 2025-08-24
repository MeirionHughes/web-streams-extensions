import { from } from "../from.js";
import { pipe } from "../pipe.js";
import { BlockingQueue, Gate } from "../utils/signal.js";
import { map } from "./map.js";
import { schedule } from "./schedule.js";
import { on } from "./on.js";
import { toPromise } from "../to-promise.js";

/**
 * Maps each source value using a projector function and flattens the projected inner result
 * into a single ReadableStream with optional concurrency control.
 *
 * Concurrency model:
 * - Projection is deferred until a concurrency slot is granted (via a Gate), so work is not
 *   started eagerly. This means Promises/async work inside the projector won't begin until
 *   capacity is available.
 * - Each projected value can be any of: ReadableStream<R>, Promise<R>, Iterable<R>, AsyncIterable<R>.
 * - The resulting inner is converted to a ReadableStream when needed and merged into the
 *   output stream as values arrive. Emission order is not guaranteed; it reflects completion timing.
 *
 * Cancellation:
 * - The projector receives an AbortSignal. If the outer stream is cancelled, all active
 *   projections receive an abort (via AbortController.abort()). Projectors should respect
 *   this signal to stop work early when possible.
 *
 * Error handling:
 * - Errors thrown by the projector or by reading inner streams are forwarded to the consumer
 *   via controller.error(err) and terminate the output stream.
 *
 * Backpressure:
 * - Values from inner streams are queued and delivered according to the consumer's pull()
 *   requests. The concurrency gate limits only the number of active inner sources, not the
 *   number of buffered items.
 */

export interface MergeMapProjector<T, R> {
  (value: T, index: number, signal?: AbortSignal): ReadableStream<R> | Promise<R> | Iterable<R> | AsyncIterable<R>;
}

/**
 * mergeMap operator
 *
 * @template T Input item type
 * @template R Output item type
 * @param project Maps each source value to a ReadableStream/Promise/Iterable/AsyncIterable.
 *   Receives (value, index, signal) where signal is aborted if the projection is cancelled.
 *   Note: The projector is invoked only after a concurrency slot is available.
 * @param concurrent Maximum number of inner projections/streams to process simultaneously.
 *   Must be > 0. Defaults to Infinity.
 * @returns Operator function that transforms and flattens the source into a ReadableStream<R>.
 * @throws Error If concurrent <= 0
 *
 * @example
 * // Map numbers to a stream of that many repeated values
 * const result = await toArray(pipe(
 *   from([1, 2, 3]),
 *   mergeMap(n => from(Array(n).fill(n)))
 * ));
 * // Emits: 1, 2, 2, 3, 3, 3 (order may vary)
 *
 * @example
 * // Limit concurrency to 2 when mapping to async work
 * const result = await toArray(pipe(
 *   from([1, 2, 3, 4]),
 *   mergeMap((n) => fetch(`/api/data/${n}`).then(r => r.json()), 2)
 * ));
 *
 * @example
 * // Provide cancellation via AbortSignal
 * pipe(
 *   from(['url1', 'url2', 'url3']),
 *   mergeMap((url, i, signal) => fetch(url, { signal }).then(r => r.text()))
 * );
 */
export function mergeMap<T, R>(
  project: MergeMapProjector<T, R>,
  concurrent: number = Infinity
): (src: ReadableStream<T>, strategy?: QueuingStrategy<R>) => ReadableStream<R> {
  if (concurrent <= 0) {
    throw new Error("Concurrency limit must be greater than zero");
  }

  return function (
    src: ReadableStream<T>,
    strategy: QueuingStrategy<R> = { highWaterMark: 16 }
  ): ReadableStream<R> {
    const outerGate = new Gate(concurrent);
    const innerQueue = new BlockingQueue<ReadableStreamReadResult<R>>();
    const abortControllers = new Set<AbortController>();
    let errored: any = null;

    return new ReadableStream<R>({
      start(outerController) {
        let reading: ReadableStream<R>[] = [];
        let readingDone = false;
        let index = 0;

        toPromise(
          pipe(
            src,
            // Block here until a concurrency slot is available
            schedule({
              schedule: (callback: () => void) => {
                outerGate.wait().then(callback);
              },
            }),
            // After a slot is reserved, invoke the projector and wire the resulting inner
            map(async (value) => {
              const currentIndex = index++;
              const abortController = new AbortController();
              abortControllers.add(abortController);

              let readableStream: ReadableStream<R> = null;
              try {
                const projected = await project(value, currentIndex, abortController.signal);
                if (projected instanceof ReadableStream) {
                  readableStream = projected;
                } else {
                  readableStream = from(projected as Promise<R> | Iterable<R> | AsyncIterable<R>);
                }
              } catch (err) {
                // Release the reserved slot if projection fails
                outerGate.increment();
                throw err;
              } finally {
                abortControllers.delete(abortController);
              }

              reading.push(readableStream);

              pipe(
                readableStream,
                map(async (innerValue) => {
                  try {
                    await innerQueue.push({ done: false, value: innerValue });
                  } catch (err) {
                    outerController.error(err);
                  }
                }),
                on({
                  error(err) {
                    errored = err;
                    outerController.error(err);
                    // Optional: release slot on error; stream is erroring out anyway
                    outerGate.increment();
                  },
                  complete() {
                    // Inner completed: free the gate slot
                    outerGate.increment();
                    const idx = reading.indexOf(readableStream);
                    if (idx !== -1) reading.splice(idx, 1);
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
              },
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
        // Abort any ongoing projections
        for (const ac of abortControllers) {
          try { ac.abort(reason); } catch {}
        }
        abortControllers.clear();
      },
    }, strategy);
  };
}
