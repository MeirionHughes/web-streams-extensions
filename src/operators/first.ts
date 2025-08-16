/**
 * Emits only the first value that matches the selector, then completes.
 * If no selector is provided, emits the first value.
 * 
 * @template T The type of elements in the stream
 * @param selector Optional predicate to test values
 * @returns A stream operator that emits only the first matching value
 * 
 * @example
 * ```typescript
 * let input = [1, 2, 3, 4];
 * let expected = [2];
 * let stream = pipe(from(input), first(x => x % 2 === 0));
 * let result = await toArray(stream);
 * ```
 */
export function first<T>(selector:(chunk:T)=>boolean=()=>true): (src: ReadableStream<T>, opts?: { highWaterMark?: number }) => ReadableStream<T> {
  return function(src: ReadableStream<T>, opts?: { highWaterMark?: number }) {
    let reader = src.getReader();
    return new ReadableStream<T>({
      async start(controller){           
        try {
          while(reader != null){
            let next = await reader.read();

            if(reader == null || next.done){
              reader = null;
              controller.close();
              return;
            }

            if(selector(next.value)){
              controller.enqueue(next.value);
              controller.close();
              try {
                await reader.cancel();
                reader.releaseLock();
              } catch (err) {
                // Ignore cleanup errors
              }
              reader = null;
              return;
            }          
          }
        } catch (err) {
          controller.error(err);
          if (reader) {
            try {
              await reader.cancel(err);
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
            reader.cancel(reason).catch(() => {
              // Ignore cancel errors
            });
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