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
      start() {
        toArray(
          pipe(
            src,
            schedule({
              nextTick: async () => {
                await outerGate.wait();
              },
            }),
            map((value) => {
              //wrap Promises as Streams
              if (!(value instanceof ReadableStream)) {
                value = from(value);
              }
              return pipe(
                value,
                //
                map(async (value) => {
                  await innerQueue.push({ done: false, value });
                }),
                //tap into complete lifecycle to track number of concurrent active streams
                on({
                  complete() {
                    outerGate.increment();
                  },
                })
              );
            }),
            mapSync((x) => toPromise(x))
          )
        )
          .then((x) => Promise.allSettled(x))
          .catch((err)=>{
            errored = err        
          })
          .finally(() => {
            innerQueue.push({ done: true });
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
