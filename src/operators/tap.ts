import { map } from "./map.js";

/**
 * Creates a tap operator that performs side effects for each value but doesn't modify the stream.
 * Useful for debugging, logging, or triggering side effects without changing the data flow.
 * 
 * @template T The type of values in the stream
 * @param cb Callback function to execute for each value (side effect only)
 * @returns A transform function that can be used with pipe()
 * 
 * @example
 * ```typescript
 * from([1, 2, 3])
 *   .pipe(
 *     tap(x => console.log('Processing:', x)), // Log each value
 *     map(x => x * 2)
 *   )
 * // Logs: Processing: 1, Processing: 2, Processing: 3
 * // Emits: 2, 4, 6
 * ```
 */
export function tap<T>(cb: (chunk: T) => void): (src: ReadableStream<T>, opts?: { highWaterMark?: number }) => ReadableStream<T> {
  return function (src: ReadableStream<T>, opts?: { highWaterMark?: number }) {
    return map((chunk: T) => {
      try {
        cb(chunk);
      } catch (err) {
        // Log error but don't break the stream for side effects
        console.error('Error in tap operator:', err);
      }
      return chunk;
    })(src, opts);
  };
}