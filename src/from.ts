import { ReadableLike, isReadableLike } from "./_readable-like.js";

export function from<T>(src: Promise<T> | Iterable<T> | AsyncIterable<T> | (() => Iterable<T> | AsyncIterable<T>) | ReadableLike<T> ): ReadableStream<T> {

  let it: Iterator<T> | AsyncIterator<T>;

  async function flush(controller: ReadableStreamDefaultController<T>) {
    try {
      while (controller.desiredSize > 0 && it != null) {
        let next = await it.next();
        if (next.done) {
          it = null;
          controller.close();
        } else {
          controller.enqueue(next.value);
        }
      }
    } catch (err) {
      controller.error(err);
    }
  }

  if(isReadableLike(src)){
    return src.readable;
  }

  return new ReadableStream<T>({
    async start(controller) {
      let iterable;

      if (typeof src == "function") { src = src(); }

      if (Symbol.asyncIterator && src[Symbol.asyncIterator]) iterable = src[Symbol.asyncIterator].bind(src);
      else if (src[Symbol.iterator]) iterable = src[Symbol.iterator].bind(src);
      else {
        let value = await Promise.resolve(src as (T | Promise<T>));
        controller.enqueue(value);
        controller.close();
        return;
      }


      it = iterable();
      return flush(controller);
    },
    async pull(controller) {      
      return flush(controller);
    },
    async cancel(reason?:any) {
      if(reason && it && it.throw){
        it.throw(reason);
      }
      else if (it && it.return) {        
        await it.return();
      }
      it = null;
    }
  });
}