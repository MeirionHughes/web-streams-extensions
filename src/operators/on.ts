
export function on<T>(callbacks: {
  start?(): void;
  complete?(reason?: any): void;
  error?(err: any): void;
}): (src: ReadableStream<T>, opts?: { highWaterMark: number; }) => ReadableStream<T> {
  let reader: ReadableStreamDefaultReader<T> = null;

  async function flush(controller: ReadableStreamDefaultController<T>) {
    try {
      while (controller.desiredSize > 0 && reader != null) {
        let next = await reader.read();
        if (next.done) {
          controller.close();
          reader = null;
          if(callbacks.complete) callbacks.complete();
        } else {
          controller.enqueue(next.value);
        }
      }
    } catch (err) {
      controller.error(err);
      if(callbacks.error) callbacks.error(err);
    }
  }
  return function (src: ReadableStream<T>, opts?: { highWaterMark: number; }) {
    return new ReadableStream<T>({
      start(controller) {
        reader = src.getReader();
        if(callbacks.start) callbacks.start();
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
          if(callbacks.complete) callbacks.complete(reason);
        }
      }
    }, opts);
  };
}
