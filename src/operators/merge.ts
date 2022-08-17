import { from } from "../from";
import { pipe } from "../pipe";
import { subscribe } from "../subscribe";
import { BlockingQueue, Gate, Signal } from "../utils/signal";
import { map } from "./map";
import { mapSync } from "./mapSync";
import { schedule } from "./schedule";
import { on } from "./on";
import { SubscriptionLike } from "../_subscription";
import { toPromise } from "../to-promise";
import { toArray } from "../to-array";

export function merge<T>(
  concurrent: number = Infinity
): (src: ReadableStream<ReadableStream<T> | Promise<T>>) => ReadableStream<T> {
  if (concurrent == 0) throw Error("zero is an invalid concurrency limit");

  return function (
    src: ReadableStream<ReadableStream<T> | Promise<T>>
  ): ReadableStream<T> {
    let outerGate = new Gate(concurrent);
    let innerQueue = new BlockingQueue<ReadableStreamDefaultReadResult<T>>();
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
