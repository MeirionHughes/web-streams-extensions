/**
 * emit an error if the duration waiting for a chunk is larger than the duration
 * @param duration timeout duration in milliseconds
 */
export function timeout<T>(duration: number): (src: ReadableStream<T>) => ReadableStream<T> {
  return function (src: ReadableStream<T>) {
    let reader: ReadableStreamDefaultReader<T> = null;
    let timer = null;
    let cancelled = false;

    async function pull(controller: ReadableStreamDefaultController<T>) {
      try {
        while (reader != null) {
          let next = await reader.read();
          if (timer != null) clearTimeout(timer);
          
          if (next.done) {            
            controller.close();
            reader = null;
          } else {
            controller.enqueue(next.value);
            timer = setTimeout(() => {
              timer = null;
              controller.error("timeout");
              if (reader) {
                reader.cancel("timeout");
                reader.releaseLock();
                reader = null;
              }           
            }, duration);
          }
        }
      } catch (err) {
        controller.error(err);
        reader.cancel(err);
      }
    }
    return new ReadableStream<T>({
      start(controller) {
        reader = src.getReader();
        return pull(controller);
      },
      pull(controller) {
        return pull(controller);
      },
      cancel(reason?: any) {
        if (reader) {
          reader.cancel(reason);
          reader.releaseLock();
          reader = null;
        }
        cancelled = true;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      }
    });
  }
}