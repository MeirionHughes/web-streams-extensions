import { map } from "./map";

export function filter<T, S extends T>(predicate: (chunk: T) => chunk is S): (src: ReadableStream<T>) => ReadableStream<S> 
export function filter<T>(predicate: (chunk: T) => boolean): (src: ReadableStream<T>) => ReadableStream<T>
export function filter<T>(predicate: (chunk: T) => boolean): (src: ReadableStream<T>) => ReadableStream<T> {
  return function (src) {
    return (map((chunk: T) => { if (predicate(chunk)) return chunk }))(src);
  }
}