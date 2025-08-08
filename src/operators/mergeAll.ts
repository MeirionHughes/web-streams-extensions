import { merge } from "./merge.js";

/**
 * Flattens a higher-order ReadableStream by merging inner streams concurrently.
 * Subscribes to all inner streams simultaneously and emits values as they arrive.
 * Order of emissions is not guaranteed.
 * 
 * @template T The type of values emitted by the inner streams
 * @param concurrent Maximum number of inner streams to process simultaneously (default: Infinity)
 * @returns A stream operator that flattens streams concurrently
 * 
 * @example
 * ```typescript
 * // Flatten arrays of streams with unlimited concurrency
 * pipe(
 *   from([
 *     from([1, 2, 3]),
 *     from([4, 5, 6]),
 *     from([7, 8, 9])
 *   ]),
 *   mergeAll()
 * )
 * // Emits: values in any order as they arrive
 * 
 * // With limited concurrency
 * pipe(
 *   from([
 *     fetch('/api/1'),
 *     fetch('/api/2'),
 *     fetch('/api/3'),
 *     fetch('/api/4')
 *   ]),
 *   mergeAll(2) // Only 2 concurrent requests
 * )
 * ```
 */
export function mergeAll<T>(
  concurrent: number = Infinity
): (
  src: ReadableStream<ReadableStream<T> | Promise<T>>, 
  opts?: { highWaterMark?: number }
) => ReadableStream<T> {
  return merge<T>(concurrent);
}
