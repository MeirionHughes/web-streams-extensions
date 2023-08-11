import { map } from "./map.js";

export function tap<T>(cb: (chunk: T) => void): (src: ReadableStream<T>, opts?: { highWaterMark: number }) => ReadableStream<T> {
  return function (src: ReadableStream<T>, opts?: { highWaterMark: number }) {
    return map((chunk: T) => {
      cb(chunk);
      return chunk;
    })(src, opts);
  }
}