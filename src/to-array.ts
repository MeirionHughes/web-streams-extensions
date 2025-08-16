import { isReadableLike, ReadableLike } from "./_readable-like.js";

/**
 * Consumes a ReadableStream and returns all values as an array.
 * The stream will be read to completion.
 * 
 * @template T The type of values in the stream
 * @param src The ReadableStream or ReadableLike to consume
 * @returns A Promise that resolves to an array containing all values from the stream
 * 
 * @example
 * ```typescript
 * let input = [1, 2, 3, 4];
 * let expected = [1, 2, 3, 4];
 * let result = await toArray(from([1, 2, 3, 4]));
 * ```
 */
export async function toArray<T>(src: ReadableLike<T>): Promise<T[]>
export async function toArray<T>(src: ReadableStream<T>): Promise<T[]>
export async function toArray<T>(src: ReadableLike<T> | ReadableStream<T>): Promise<T[]> {
  let res: T[] = [];

  if (isReadableLike(src)) {
    src = src.readable;
  }

  let reader = src.getReader();
  try {
    let done = false;

    while (done == false) {
      let next = await reader.read();
      done = next.done;
      if (!done) res.push(next.value);
    }
  } finally {
    // Always cancel the reader to ensure proper cleanup of resources
    try {
      await reader.cancel();
    } catch (e) {
      // Ignore cancellation errors (stream might already be closed)
    }
    reader.releaseLock();    
  }
  return res;
}