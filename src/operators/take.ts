
/**
 * buffer elements and then send an array to the reader. 
 * @param count elements to buffer before enqueue
 */
export function take<T>(count: number, highWaterMark = 16): (src:ReadableStream<T>)=>ReadableStream<T>{ 
  return function(src:ReadableStream<T>){
    let reader: ReadableStreamDefaultReader<T> = null;
    let taken = 0;

    async function flush(controller: ReadableStreamDefaultController<T>) {
      try {
        while (taken < count && controller.desiredSize > 0 && reader != null) {
          let next = await reader.read();
          if(next.done){          
            reader = null;                   
          }else {
            taken += 1;
            controller.enqueue(next.value);           
          }          
        }
        controller.close();  
        if(reader){ reader.cancel(); reader.releaseLock(); }
        reader = null;  

      } catch (err) {
        controller.error(err);
      }
    }

    return new ReadableStream<T>({
      start(controller) {
        reader = src.getReader();
        return flush(controller);
      },
      pull(controller) {
        return flush(controller);
      },
      cancel(reason?:any) {
        if(reader){
          reader.cancel(reason);
          reader.releaseLock();
          reader = null;
        }
      }
    }, {highWaterMark});
  }
}