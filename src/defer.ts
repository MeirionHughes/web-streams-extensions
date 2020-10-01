export function defer<T>(src:()=>Promise<ReadableStream<T>> | ReadableStream<T>): ReadableStream<T>{
  
  let readable: ReadableStream<T> = null;  
  let reader: ReadableStreamDefaultReader<T> = null;
  
  async function flush(controller: ReadableStreamDefaultController<T>) {
    try {
      while (controller.desiredSize > 0 && reader) {   
        console.log("reading... ")
        let result = await reader.read();
        if(result.value){
          controller.enqueue(result.value);
        }
        if(result.done){
          reader = null;
          readable = null;
          controller.close();    
        }
      }
    } catch (err) {
      controller.error(err);
    }
  }

  return new ReadableStream<T>({
    async start(controller) {
      console.log("awaiting source");

      readable = await src();
      reader = readable.getReader();

      console.log("flushing source");

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