import { isReadableLike, ReadableLike } from "./_readable-like.js";

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
    reader.releaseLock();    
  }
  return res;
}