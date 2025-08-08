import { from } from "../from.js";
import { pipe } from "../pipe.js";
import { merge } from "./merge.js";
import { map } from "./map.js";

/**
 * Maps each source value to a ReadableStream, Promise, or array, then flattens all inner streams
 * into a single output stream with optional concurrency control.
 * Similar to RxJS mergeMap/flatMap operator.
 * 
 * @template T The input type
 * @template R The output type of the inner streams
 * @param project A function that maps each source value to a ReadableStream, Promise, or array
 * @param concurrent Maximum number of inner streams to process simultaneously (default: Infinity)
 * @returns A stream operator that transforms and flattens values
 * 
 * @example
 * ```typescript
 * // Map each number to a stream of that many values
 * pipe(
 *   from([1, 2, 3]),
 *   mergeMap(n => from(Array(n).fill(n)))
 * )
 * // Emits: 1, 2, 2, 3, 3, 3 (order may vary due to concurrency)
 * 
 * // With limited concurrency
 * pipe(
 *   from([1, 2, 3, 4]),
 *   mergeMap(n => fetch(`/api/data/${n}`).then(r => r.json()), 2)
 * )
 * // Only 2 concurrent requests at a time
 * ```
 */
export interface MergeMapProjector<T, R> {
  (value: T, index: number): ReadableStream<R> | Promise<R> | ArrayLike<R>;
}

export function mergeMap<T, R>(
  project: MergeMapProjector<T, R>,
  concurrent: number = Infinity
): (src: ReadableStream<T>, opts?: { highWaterMark?: number }) => ReadableStream<R> {
  if (concurrent <= 0) {
    throw new Error("Concurrency limit must be greater than zero");
  }

  return function (src: ReadableStream<T>, opts?: { highWaterMark?: number }) {
    let index = 0;
    
    const mappedStream = pipe(
      src,
      map(async (value) => {
        const currentIndex = index++;
        const projected = await project(value, currentIndex);
        
        // Convert to ReadableStream if needed
        if (projected instanceof ReadableStream) {
          return projected;
        } else if (Array.isArray(projected)) {
          return from(projected);
        } else {
          // Assume it's a Promise
          return from(projected as Promise<R>);
        }
      })
    );
    
    return merge<R>(concurrent)(mappedStream);
  };
}
