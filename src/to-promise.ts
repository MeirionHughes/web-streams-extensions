import { isReadableLike, ReadableLike } from "./_readable-like.js";

/** 
 * Consumes a ReadableStream and returns a promise that resolves with the last value.
 * The stream will be read to completion and only the final value is returned.
 * 
 * @template T The type of values in the stream
 * @param src The ReadableStream or ReadableLike to consume
 * @returns A Promise that resolves to the last value emitted by the stream
 * 
 * @example
 * ```typescript
 * let input = [1, 2, 3, 4];
 * let expected = 4;
 * let result = await toPromise(from([1, 2, 3, 4]));
 * ```
 */
export async function toPromise<T>(src: ReadableLike<T>): Promise<T>
export async function toPromise<T>(src: ReadableStream<T>): Promise<T>
export async function toPromise<T>(src: ReadableLike<T> | ReadableStream<T>): Promise<T> {
  let res: T = undefined;

  if(isReadableLike(src)){
    src = src.readable;
  }

  let reader = src.getReader();
  try {
    let done = false;

    while (done == false) {
      let next = await reader.read();
      done = next.done;
      if (!done) res = next.value;
    }
  } finally {
    reader.releaseLock();
  }
  return res;
}