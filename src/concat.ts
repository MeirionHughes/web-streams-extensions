export function concat<T>(...streams: ReadableStream<T>[]): ReadableStream<T>{
  if(streams.length == 0) throw Error("must pass at least 1 stream to concat");
  
  let reader: ReadableStreamDefaultReader<T> = null;

  async function flush(controller: ReadableStreamDefaultController<T>) {
    try {      
      if(reader == null) { 
        if(streams.length == 0){
          controller.close();     
        }
        reader = streams.shift().getReader();
      }

      while (controller.desiredSize > 0 && reader != null) {
        let next = await reader.read();
        // if the current reader is exhausted... 
        if(next.done){
          reader = null;
        }else {
          controller.enqueue(next.value);
        }
      }
    } catch (err) {
      controller.error(err);
    }
  }

  return new ReadableStream<T>({
    async start(controller) {
      return flush(controller);
    },
    async pull(controller) {
      return flush(controller);
    },
    async cancel() {
      if(reader){
        reader.releaseLock();
      }
    }
  });
}