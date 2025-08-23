import { from } from "../from.js";
import { pipe } from "../pipe.js";
import { mergeAll } from "./mergeAll.js";
import { map } from "./map.js";

/**
 * Maps each source value to a ReadableStream, Promise, or array, then flattens all inner streams
 * into a single output stream with optional concurrency control.
 * Similar to RxJS mergeMap/flatMap operator.
 * 
 * @template T The input type
 * @template R The output type of the inner streams
 * @param project A function that maps each source value to a ReadableStream, Promise, or array.
 *                Receives (value, index, signal) where signal is an AbortSignal that will be 
 *                aborted when this projection is cancelled
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
 * 
 * // HTTP requests with proper cancellation
 * pipe(
 *   from(['url1', 'url2', 'url3']),
 *   mergeMap((url, index, signal) => 
 *     fetch(url, { signal }).then(r => r.json()).then(data => from([data]))
 *   )
 * )
 * // Concurrent requests with proper cancellation support
 * ```
 */
export interface MergeMapProjector<T, R> {
  (value: T, index: number, signal?: AbortSignal): ReadableStream<R> | Promise<R> | Iterable<R> | AsyncIterable<R>;
}

export function mergeMap<T, R>(
  project: MergeMapProjector<T, R>,
  concurrent: number = Infinity
): (src: ReadableStream<T>, strategy?: QueuingStrategy<R>) => ReadableStream<R> {
  if (concurrent <= 0) {
    throw new Error("Concurrency limit must be greater than zero");
  }

  return function (src: ReadableStream<T>, strategy: QueuingStrategy<R> = { highWaterMark: 16 }) {
    let index = 0;
    const abortControllers = new Set<AbortController>();
    
    const mappedStream = pipe(
      src,
      map(async (value) => {
        const currentIndex = index++;
        
        // Create new AbortController for each projection
        const abortController = new AbortController();
        abortControllers.add(abortController);
        
        try {
          const projected = await project(value, currentIndex, abortController.signal);
          
          // Convert to ReadableStream if needed
          if (projected instanceof ReadableStream) {
            return projected;
          } else if (Array.isArray(projected)) {
            return from(projected);
          } else {
            // Assume it's a Promise
            return from(projected as Promise<R>);
          }
        } finally {
          abortControllers.delete(abortController);
        }
      })
    );
    
    return new ReadableStream<R>({
      start(controller) {
        const flattened = mergeAll<R>(concurrent)(mappedStream);
        const reader = flattened.getReader();
        
        const pump = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                controller.close();
                break;
              }
              controller.enqueue(value);
            }
          } catch (err) {
            controller.error(err);
          }
        };
        
        pump();
      },
      cancel() {
        // Cancel any ongoing projections
        for (const abortController of abortControllers) {
          abortController.abort();
        }
        abortControllers.clear();
      }
    }, strategy);
  };
}
