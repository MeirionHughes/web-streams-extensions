export function concatAll<T>(): (src: ReadableStream<ReadableStream<T>>) => ReadableStream<T> {
  return function (src: ReadableStream<ReadableStream<T>>) {
    let readerSrc:  ReadableStreamDefaultReader<ReadableStream<T>> = null;
    let reader: ReadableStreamDefaultReader<T> = null;

    async function flush(controller: ReadableStreamDefaultController<T>) {
      try {        
        if (reader == null) {
          let next = await readerSrc.read();
          if(next.done){
            controller.close();
          }else{
            reader = next.value.getReader();
          }
        }

        while (controller.desiredSize > 0 && reader != null) {
          let next = await reader.read();
          // if the current reader is exhausted... 
          if (next.done) {
            reader = null;
          } else {
            controller.enqueue(next.value);
          }
        }
      } catch (err) {
        controller.error(err);
      }
    }

    return new ReadableStream<T>({
      async start(controller) {       
        readerSrc = src.getReader(); 
        return flush(controller);
      },
      async pull(controller) {
        return flush(controller);
      },
      async cancel() {
        if (readerSrc) {
          readerSrc.releaseLock();
        }
        if (reader) {
          readerSrc.releaseLock();
        }
      }
    });
  }
}