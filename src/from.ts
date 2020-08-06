export function from<T>(array: T[]): ReadableStream<T>{
  let reader: ReadableStreamDefaultReader<T> = null;
  let pos = 0;
  let len = array.length;

  async function flush(controller: ReadableStreamDefaultController<T>) {
    try {      
      while (controller.desiredSize > 0 && pos < len) {    
        controller.enqueue(array[pos++]);;      
      }
      if(pos >= len){
        controller.close();
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