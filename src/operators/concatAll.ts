import { isReadableStream } from "../utils/is-readable";

export function concatAll<T>(): (src: ReadableStream<ReadableStream<T>> | ReadableStream<Promise<T[] | T> | T[] | T>) => ReadableStream<T> {
  return function (src: ReadableStream<ReadableStream<T>>) {
    let readerSrc:  ReadableStreamDefaultReader<ReadableStream<T> | Promise<T>> = null;
    let reader: ReadableStreamDefaultReader<T> = null;

    async function flush(controller: ReadableStreamDefaultController<T>) {
      try {        
        if (reader == null) {
          let next = await readerSrc.read();

          if(next.done){
            controller.close();
          }else{
            let src = await next.value;
            if(Array.isArray(src)){
              for(let item of src){
                controller.enqueue(item);
              }
            }else if(isReadableStream(src)){ 
              reader = src.getReader();
            }else{
              controller.enqueue(src);
              return;            
            }      
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

