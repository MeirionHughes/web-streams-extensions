/**
 * Emits only the last value that matches the selector.
 * If no selector is provided, emits the last value.
 * The stream must complete for the last value to be emitted.
 * 
 * @template T The type of elements in the stream
 * @param selector Optional predicate to test values
 * @returns A stream operator that emits only the last matching value
 * 
 * @example
 * ```typescript
 * let input = [1, 2, 3, 4];
 * let expected = [4];
 * let stream = pipe(from(input), last(x => x % 2 === 0));
 * let result = await toArray(stream);
 * ```
 */
export function last<T>(selector:(chunk:T)=>boolean=()=>true): (src: ReadableStream<T>, opts?: { highWaterMark?: number }) => ReadableStream<T> {
  return function(src: ReadableStream<T>, opts?: { highWaterMark?: number }) {
    let reader = src.getReader();
    let lastValue: T | undefined = undefined;
    let hasValue = false;
    
    return new ReadableStream<T>({
      async start(controller){
        try {        
          while(reader){
            let next = await reader.read();
            if(reader == null){
              //cancelled
              controller.close();
              return;
            }          
            if(next.done){ 
              if (hasValue) {
                controller.enqueue(lastValue);
              }
              controller.close();
              reader.releaseLock();
              reader = null;
              return;
            }
            if(selector(next.value)){
              lastValue = next.value;
              hasValue = true;
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
      },
      cancel(reason?:any){
        if (reader) {
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
    }, { highWaterMark: opts?.highWaterMark ?? 16 })
  }
}