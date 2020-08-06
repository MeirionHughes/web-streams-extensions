import { map } from "./map";

export function tap<T>(cb: (chunk: T) => void): (src: ReadableStream<T>) => ReadableStream<T> {
  return function (src: ReadableStream<T>) {
    return map((chunk: T) => {
      cb(chunk);
      return chunk;
    })(src);
  }
}