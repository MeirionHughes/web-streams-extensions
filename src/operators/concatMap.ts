import { from } from "../from.js";
import { pipe } from "../pipe.js";
import { concatAll } from "./concatAll.js";
import { map } from "./map.js";

/**
 * Maps each source value to a ReadableStream, Promise, or array, then flattens all inner streams
 * sequentially (waits for each inner stream to complete before starting the next).
 * Similar to RxJS concatMap operator.
 * 
 * @template T The input type
 * @template R The output type of the inner streams
 * @param project A function that maps each source value to a ReadableStream, Promise, or array
 * @returns A stream operator that transforms and flattens values sequentially
 * 
 * @example
 * ```typescript
 * // Map each number to a delayed stream
 * pipe(
 *   from([1, 2, 3]),
 *   concatMap(n => timer(100).pipe(map(() => n)))
 * )
 * // Emits: 1 (after 100ms), 2 (after 200ms), 3 (after 300ms)
 * // Sequential execution - waits for each inner stream
 * 
 * // Map to arrays
 * pipe(
 *   from(['a', 'b']),
 *   concatMap(letter => [letter, letter.toUpperCase()])
 * )
 * // Emits: 'a', 'A', 'b', 'B' (in order)
 * ```
 */
export interface ConcatMapProjector<T, R> {
  (value: T, index: number): ReadableStream<R> | Promise<R> | ArrayLike<R>;
}

export function concatMap<T, R>(
  project: ConcatMapProjector<T, R>
): (src: ReadableStream<T>, opts?: { highWaterMark?: number }) => ReadableStream<R> {
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
    
    // Use concatAll to ensure sequential processing
    return concatAll<R>()(mappedStream);
  };
}
