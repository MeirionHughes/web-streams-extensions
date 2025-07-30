/**
 * Joins two ReadableStreams by combining their values using a selector function.
 * Values are paired up as they arrive, and the stream completes when either source completes.
 * 
 * @template A The type of values from the first stream
 * @template B The type of values from the second stream  
 * @template R The type of the resulting combined values
 * @param srcA The first ReadableStream
 * @param srcB The second ReadableStream
 * @param selector Function to combine values from both streams
 * @returns A ReadableStream of combined values
 * 
 * @example
 * ```typescript
 * let streamA = from([1, 2, 3]);
 * let streamB = from(['a', 'b', 'c']);
 * let joined = join(streamA, streamB, (a, b) => `${a}${b}`);
 * // Emits: "1a", "2b", "3c"
 * ```
 */
export function join<A, B, R>(srcA: ReadableStream<A>, srcB: ReadableStream<B>, selector: (a: A, b: B) => R): ReadableStream<R>{
  let readerA: ReadableStreamDefaultReader<A> | null = null;
  let readerB: ReadableStreamDefaultReader<B> | null = null;

  return new ReadableStream<R>({
    async start(){
       readerA = srcA.getReader();
       readerB = srcB.getReader();
    },
    async pull(controller){
      try {
        let nexts = await Promise.all([readerA!.read(), readerB!.read()]);
        let done = nexts[0].done || nexts[1].done;
        if(done){
          controller.close();
          if(nexts[0].done === false && readerA) {
            readerA.releaseLock();
            readerA = null;
          }
          if(nexts[1].done === false && readerB) {
            readerB.releaseLock();
            readerB = null;
          }
        } else {
          const result = selector(nexts[0].value, nexts[1].value);
          controller.enqueue(result);
        }
      } catch (err) {
        controller.error(err);
        // Cleanup on error
        if (readerA) {
          try {
            readerA.cancel(err);
            readerA.releaseLock();
          } catch (e) {
            // Ignore cleanup errors
          }
          readerA = null;
        }
        if (readerB) {
          try {
            readerB.cancel(err);
            readerB.releaseLock();
          } catch (e) {
            // Ignore cleanup errors
          }
          readerB = null;
        }
      }
    },
    async cancel(reason?: any){
      if(readerA) {
        try {
          readerA.cancel(reason);
          readerA.releaseLock();
        } catch (err) {
          // Ignore cleanup errors
        } finally {
          readerA = null;
        }
      }
      if(readerB) {
        try {
          readerB.cancel(reason);
          readerB.releaseLock();
        } catch (err) {
          // Ignore cleanup errors
        } finally {
          readerB = null;
        }
      }
    }
  });   
}