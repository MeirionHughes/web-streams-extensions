import { isReadableLike, ReadableLike } from "./_readable-like";

/** return a promise that resolves once the stream is exhausted. 
 * @returns last value;
 */
export async function toPromise<T>(src: ReadableLike<T>): Promise<T>
export async function toPromise<T>(src: ReadableStream<T>): Promise<T>
export async function toPromise<T>(src: ReadableLike<T> | ReadableStream<T>): Promise<T> {
  let res: T = undefined;

  if(isReadableLike(src)){
    src = src.readable;
  }

  let reader = src.getReader();
  let done = false;

  while (done == false) {
    let next = await reader.read();
    done = next.done;
    if (!done) res = next.value;
  }
  return res;
}