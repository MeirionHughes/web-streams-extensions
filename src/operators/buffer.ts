import { read } from "fs";

/**
 * buffer elements and then send an array to the reader. 
 * @param count elements to buffer before enqueue
 */
export function buffer<T>(count: number, highWaterMark = 16): (src:ReadableStream<T>)=>ReadableStream<T[]>{ 
  return function(src:ReadableStream<T>){
    let reader: ReadableStreamDefaultReader<T> = null;
    let buffer = [];

    async function flush(controller: ReadableStreamDefaultController<T[]>) {
      try {
        while (controller.desiredSize > 0 && reader != null) {
          let next = await reader.read();
          if(next.done){
            if(buffer.length>0){              
              controller.enqueue(buffer);
            }
            controller.close();            
            reader = null;                     
          }else {
            buffer.push(next.value)
            if(buffer.length>=count){              
              controller.enqueue(buffer);
              buffer = []
            }
          }          
        }
      } catch (err) {
        controller.error(err);
      }
    }

    return new ReadableStream<T[]>({
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