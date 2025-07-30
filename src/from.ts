import { ReadableLike, isReadableLike } from "./_readable-like.js";

/**
 * Creates a ReadableStream from various input sources.
 * Supports iterables, async iterables, promises, functions returning iterables, and ReadableLike objects.
 * 
 * @template T The type of values emitted by the resulting stream
 * @param src The source to convert to a ReadableStream
 * @returns A ReadableStream that emits values from the source
 * 
 * @example
 * ```typescript
 * // From array
 * from([1, 2, 3, 4])
 * 
 * // From generator function
 * from(function*() { yield 1; yield 2; yield 3; yield 4; })
 * 
 * // From async generator function
 * from(async function*() { yield 1; yield 2; yield 3; yield await Promise.resolve(4); })
 * 
 * // From promise
 * from(Promise.resolve([1, 2, 3, 4]))
 * ```
 */
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
      it = null;
    }
  }

  if(isReadableLike(src)){
    return src.readable;
  }

  return new ReadableStream<T>({
    async start(controller) {
      try {
        let iterable;

        if (typeof src == "function") { 
          src = src(); 
        }

        if (Symbol.asyncIterator && src[Symbol.asyncIterator]) {
          iterable = src[Symbol.asyncIterator].bind(src);
        } else if (src[Symbol.iterator]) {
          iterable = src[Symbol.iterator].bind(src);
        } else {
          // Handle promises and single values
          let value = await Promise.resolve(src as (T | Promise<T>));
          controller.enqueue(value);
          controller.close();
          return;
        }

        it = iterable();
        return flush(controller);
      } catch (err) {
        controller.error(err);
      }
    },
    async pull(controller) {      
      return flush(controller);
    },
    async cancel(reason?: any) {
      if (it) {
        try {
          if (reason && it.throw) {
            await it.throw(reason);
          } else if (it.return) {        
            await it.return();
          }
        } catch (err) {
          // Ignore errors during cleanup
        } finally {
          it = null;
        }
      }
    }
  });
}