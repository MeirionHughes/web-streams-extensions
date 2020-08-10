
/**
 * given a stream of T and selector f(T)->R, return a stream of R, where f(T) != undefined
 * @param stream the stream of T elements to map
 * @param select a method to select R given a T, undefined values are not enqueued 
 * @param highWaterMark max cache size of stream<R>
 */
export interface MapSelector<T, R> {
  (chunk: T): R;
}
export function map<T, R = T>(select: MapSelector<T, R>): (src: ReadableStream<T>, opts?: { highWaterMark: number }) => ReadableStream<R> {
  let reader: ReadableStreamDefaultReader<T> = null;

  async function flush(controller: ReadableStreamDefaultController<R>) {
    try {
      while (controller.desiredSize > 0 && reader != null) {
        let next = await reader.read();
        if (next.done) {
          controller.close();
          reader = null;
        } else {
          let mapped = select(next.value);
          if (mapped !== undefined)
            controller.enqueue(mapped);
        }
      }
    } catch (err) {
      controller.error(err);
    }
  }
  return function (src: ReadableStream<T>, opts?: { highWaterMark: number }) {
    return new ReadableStream<R>({
      start(controller) {
        reader = src.getReader();
        return flush(controller);
      },
      pull(controller) {
        return flush(controller);
      },
      cancel() {
        if (reader) {
          reader.releaseLock();
          reader = null;
        }
      }
    }, opts );
  }
}