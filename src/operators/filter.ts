import { mapSync } from "./mapSync.js";

/**
 * Filters values in a stream based on a predicate function.
 * Only values that pass the predicate test are emitted by the resulting stream.
 * 
 * @template T The input type
 * @template S The narrowed output type (for type guard predicates)
 * @param predicate A function that tests each value
 * @returns A stream operator that filters values
 * 
 * @example
 * ```typescript
 * pipe(
 *   from([1, 2, 3, 4, 5, 6]),
 *   filter(x => x % 2 === 0)
 * )
 * // Emits: 2, 4, 6
 * ```
 */
export function filter<T, S extends T>(predicate: (chunk: T) => chunk is S): (src: ReadableStream<T>, strategy?: QueuingStrategy<S>) => ReadableStream<S> 
export function filter<T>(predicate: (chunk: T) => boolean): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T>
export function filter<T>(predicate: (chunk: T) => boolean): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T> {
  return function (src, strategy: QueuingStrategy<T> = { highWaterMark: 16 }) {
    return (mapSync((chunk: T) => { 
      if (predicate(chunk)) return chunk;
      // Return undefined to filter out this value (map will not enqueue undefined values)
    }))(src, strategy);
  }
}