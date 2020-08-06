
/**
 * given a stream of T and selector f(T)->R returns a stream of R where R != undefined
 * @param stream the stream of T elements to map
 * @param select a method to select R given a T, undefined values are not enqueued 
 * @param highWaterMark max cache size of stream<R>
 */
export function map<T, R>(stream: ReadableStream<T>, select:(chunk:T)=>R, highWaterMark = 32): ReadableStream<R>{ 
  let reader: ReadableStreamDefaultReader<T> = null;

  async function flush(controller: ReadableStreamDefaultController<R>) {
    try {
      while (controller.desiredSize > 0 && reader != null) {
        let next = await reader.read();
        if(next.done){
          controller.close();
          reader = null;         
        }else {
          let mapped = select(next.value);
          if(mapped !== undefined)
            controller.enqueue(mapped);
        }
      }
    } catch (err) {
      controller.error(err);
    }
  }
  return new ReadableStream<R>({
    start(controller) {
      reader = stream.getReader();
      return flush(controller);
    },
    pull(controller) {
      return flush(controller);
    },
    cancel() {
      if(reader){
        reader.releaseLock();
        reader = null;
      }
    }
  }, {highWaterMark});
}