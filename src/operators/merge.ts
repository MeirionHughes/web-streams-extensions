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

export function merge<T>(
  concurrent: number = Infinity
): (src: ReadableStream<ReadableStream<T> | Promise<T>>) => ReadableStream<T> {
  if (concurrent == 0) throw Error("zero is an invalid concurrency limit");

  return function (
    src: ReadableStream<ReadableStream<T> | Promise<T>>
  ): ReadableStream<T> {
    let outerGate = new Gate(concurrent);
    let innerQueue = new BlockingQueue<ReadableStreamReadResult<T>>();
    let subscription: SubscriptionLike;
    let errored = null;

    return new ReadableStream({
      start(outerController) {
        let reading = [];
        let readingDone = false;

        toPromise(
          pipe(
            src,
            schedule({
              nextTick: async () => {
                await outerGate.wait();
              },
            }),
            map((innerStream) => {
              //wrap Promises as Streams
              if (!(innerStream instanceof ReadableStream)) {
                innerStream = from(innerStream);
              }

              reading.push(innerStream);

              pipe(
                innerStream,
                //
                map(async (value) => {
                  await innerQueue.push({ done: false, value });
                }),
                //tap into complete lifecycle to track number of concurrent active streams
                on({
                  error(err){
                    outerController.error(err);
                  },
                  complete() {
                    outerGate.increment();
                    reading.splice(reading.indexOf(innerStream), 1);
                    if (reading.length == 0 && readingDone){
                      innerQueue.push({ done: true });
                    }
                  },
                })
              );
            }),
            on({
              error(err) {
                outerController.error(err);
                errored = err
              },
              complete() {
                readingDone = true;
              }
            })
          )).catch((err) => {
            outerController.error(err);
          });
      },
      async pull(controller) {
        while (controller.desiredSize > 0) {
          let next = await innerQueue.pull();
          if (errored) {
            controller.error(errored);
          }
          if (next.done) {
            controller.close();
          } else {
            controller.enqueue(next.value);
          }
        }
      },
      cancel(reason?: any) {
        if (subscription) {
          subscription.unsubscribe();
          subscription = null;
        }
      },
    });
  };
}
