import { IScheduler } from "../_scheduler";

/**
 * 
 * @param scheduler operator to schedule pipe-through 
 * @returns 
 */
export function schedule<T>(scheduler: IScheduler): (src: ReadableStream<T>, opts?: { highWaterMark: number }) => ReadableStream<T> {
  let reader: ReadableStreamDefaultReader<T> = null;

  async function flush(controller: ReadableStreamDefaultController<T>) {
    try {
      while (controller.desiredSize > 0 && reader != null) {
        let next = await reader.read();
        if (next.done) {
          controller.close();
          reader = null;
        } else {
          await scheduler.nextTick();
          controller.enqueue(next.value);
        }
      }
    } catch (err) {
      controller.error(err);
    }
  }
  return function (src: ReadableStream<T>, opts?: { highWaterMark: number }) {
    return new ReadableStream<T>({
      start(controller) {
        reader = src.getReader();
        return flush(controller);
      },
      pull(controller) {
        return flush(controller);
      },
      cancel(reason?: any) {
        if (reader) {
          reader.cancel(reason);
          reader.releaseLock();
          reader = null;
        }
      }
    }, opts);
  }
}