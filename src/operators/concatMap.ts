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
 * @param project A function that maps each source value to a ReadableStream, Promise, or array.
 *                Receives (value, index, signal) where signal is an AbortSignal that will be 
 *                aborted when this projection is cancelled
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
 * 
 * // HTTP requests with proper cancellation
 * pipe(
 *   from(['url1', 'url2', 'url3']),
 *   concatMap((url, index, signal) => 
 *     fetch(url, { signal }).then(r => r.json()).then(data => from([data]))
 *   )
 * )
 * // Requests are made sequentially, can be cancelled via AbortSignal
 * ```
 */
export interface ConcatMapProjector<T, R> {
  (value: T, index: number, signal?: AbortSignal): ReadableStream<R> | Promise<R> | Iterable<R> | AsyncIterable<R>;
}

export function concatMap<T, R>(
  project: ConcatMapProjector<T, R>
): (src: ReadableStream<T>, opts?: { highWaterMark?: number }) => ReadableStream<R> {
  return function (src: ReadableStream<T>, opts?: { highWaterMark?: number }) {
    let index = 0;
    let abortController: AbortController | null = null;
    
    const mappedStream = pipe(
      src,
      map(async (value) => {
        const currentIndex = index++;
        
        // Create new AbortController for each projection
        abortController = new AbortController();
        const projected = project(value, currentIndex, abortController.signal);
        
        // Convert to ReadableStream if needed
        if (projected instanceof ReadableStream) {
          return projected;
        } else {
          // Use from() to handle Promise<R>, Iterable<R>, or AsyncIterable<R>
          return from(projected);
        }
      })
    );
    
    // Use concatAll to ensure sequential processing
    return new ReadableStream<R>({
      start(controller) {
        const flattened = concatAll<R>()(mappedStream);
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
        // Cancel any ongoing projection
        if (abortController) {
          abortController.abort();
        }
      }
    }, opts);
  };
}
