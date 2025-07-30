
/**
 * Maps each value in a stream through a selector function.
 * Given a stream of T and selector f(T) -> R, returns a stream of R.
 * Values where the selector returns undefined are not enqueued.
 * 
 * @template T The input type
 * @template R The output type
 * @param select A function to transform T to R, undefined values are filtered out
 * @returns A stream operator that transforms values
 * 
 * @example
 * ```typescript
 * pipe(
 *   from([1, 2, 3, 4]),
 *   map(x => x * 2)
 * )
 * // Emits: 2, 4, 6, 8
 * ```
 */
export interface MapSelector<T, R> {
  (chunk: T): R | Promise<R>
}

export function map<T, R = T>(select: MapSelector<T, R>): (src: ReadableStream<T>, opts?: { highWaterMark: number }) => ReadableStream<R> {
  let reader: ReadableStreamDefaultReader<T> = null;

  async function flush(controller: ReadableStreamDefaultController<R>) {
    try {
      while (controller.desiredSize > 0 && reader != null) {
        let next = await reader.read();
        if (next.done) {
          controller.close();
          reader.releaseLock();
          reader = null;
        } else {
          let mapped = await select(next.value);
          if (mapped !== undefined)
            controller.enqueue(mapped);
        }
      }
    } catch (err) {
      controller.error(err);
      if (reader) {
        try {
          reader.cancel(err);
          reader.releaseLock();
        } catch (e) {
          // Ignore cleanup errors
        }
        reader = null;
      }
    }
  }
  
  return function (src: ReadableStream<T>, opts?: { highWaterMark: number }) {
    return new ReadableStream<R>({
      start(controller) {
        reader = src.getReader();
        return flush(controller);
      },
      pull(controller) {
        return flush(controller);
      },
      cancel(reason?: any){        
        if (reader) {
          try {
            reader.cancel(reason);
            reader.releaseLock();
          } catch (err) {
            // Ignore cleanup errors
          } finally {
            reader = null;
          }
        }
      }
    }, opts );
  }
}