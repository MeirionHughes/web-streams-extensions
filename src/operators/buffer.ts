/**
 * Buffers elements from the source stream and emits them as arrays when the buffer reaches the specified count.
 * The final buffer (if not empty) is emitted when the source stream completes.
 * 
 * @template T The type of elements to buffer
 * @param count The number of elements to buffer before emitting
 * @param highWaterMark The high water mark for the output stream
 * @returns A stream operator that buffers elements into arrays
 * 
 * @example
 * ```typescript
 * let input = [1, 2, 3, 4];
 * let expected = [[1, 2], [3, 4]];
 * let stream = buffer(2)(from(input));
 * let result = await toArray(stream);
 * ```
 */
export function buffer<T>(count: number, highWaterMark = 16): (src:ReadableStream<T>)=>ReadableStream<T[]>{ 
  if (count <= 0) {
    throw new Error("Buffer count must be greater than 0");
  }
  
  return function(src:ReadableStream<T>){
    let reader: ReadableStreamDefaultReader<T> = null;
    let buffer: T[] = [];

    async function flush(controller: ReadableStreamDefaultController<T[]>) {
      try {
        while (controller.desiredSize > 0 && reader != null) {
          let next = await reader.read();
          if(next.done){
            // Emit final buffer if it has elements
            if(buffer.length > 0 ){              
              controller.enqueue(buffer);
              buffer = [];
            }
            controller.close();
            reader.releaseLock();
            reader = null;                     
          }else {
            buffer.push(next.value);
            // Emit buffer when it reaches the target count
            if(buffer.length >= count){              
              controller.enqueue(buffer);
              buffer = [];
            }
          }          
        }
      } catch (err) {
        controller.error(err);
        if (reader) {
          try {
            reader.cancel(err);
            reader.releaseLock();
          } catch (e) {
            // Ignore cleanup errors
          }
          reader = null;
        }
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
          try {
            reader.cancel(reason);
            reader.releaseLock();
          } catch (err) {
            // Ignore cleanup errors
          } finally {
            reader = null;
          }
        }
      }
    }, {highWaterMark});
  }
}