/**
 * Defers the creation of a ReadableStream until it's actually read from.
 * The callback is invoked when the stream starts, allowing for lazy initialization.
 * 
 * @template T The type of values emitted by the resulting stream
 * @param src A callback that returns a ReadableStream or a Promise that resolves to a ReadableStream
 * @returns A ReadableStream that wraps the deferred stream
 * 
 * @example
 * ```typescript
 * let input = [1, 2, 3, 4];
 * let expected = [1, 2, 3, 4];
 * 
 * let result = await toArray(defer(() => Promise.resolve(from(input))));
 * ```
 */
export function defer<T>(src:()=>Promise<ReadableStream<T>> | ReadableStream<T>): ReadableStream<T>{
  
  let readable: ReadableStream<T> = null;  
  let reader: ReadableStreamDefaultReader<T> = null;
  
  async function flush(controller: ReadableStreamDefaultController<T>) {
    try {
      while (controller.desiredSize > 0 && reader) { 
        let result = await reader.read();
        if(result.done){
          reader.releaseLock();
          reader = null;
          readable = null;
          controller.close();
          return;    
        } else {
          controller.enqueue(result.value);
        }
      }
    } catch (err) {
      controller.error(err);
      if (reader) {
        try {
          reader.releaseLock();
        } catch (e) {
          // Ignore cleanup errors
        }
        reader = null;
      }
    }
  }

  return new ReadableStream<T>({
    async start(controller) {
      try {
        readable = await src();
        reader = readable.getReader();
        return flush(controller);
      } catch (err) {
        controller.error(err);
      }
    },
    async pull(controller) {
      return flush(controller);
    },
    async cancel(reason?: any) {
      if(reader){
        try {
          await reader.cancel(reason);
        } catch (err) {
          // Ignore cleanup errors
        } finally {
          try {
            reader.releaseLock();
          } catch (err) {
            // Ignore release errors
          }
          reader = null;
        }
      }
    }
  });
}