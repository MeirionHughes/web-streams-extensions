
/**
 * Maps each value in a stream through a synchronous selector function.
 * Similar to map() but optimized for synchronous transformations that don't return promises.
 * Values where the selector returns undefined are filtered out.
 * 
 * @template T The input type
 * @template R The output type
 * @param select A synchronous function to transform T to R, undefined values are filtered out
 * @returns A stream operator that transforms values synchronously
 * 
 * @example
 * ```typescript
 * from([1, 2, 3, 4])
 *   .pipe(
 *     mapSync(x => x % 2 === 0 ? x * 2 : undefined) // Only even numbers, doubled
 *   )
 * // Emits: 4, 8
 * ```
 */
export interface MapSyncSelector<T, R> {
  (chunk: T): R | undefined;
}

export function mapSync<T, R = T>(select: MapSyncSelector<T, R>): (src: ReadableStream<T>, opts?: { highWaterMark?: number }) => ReadableStream<R> {
  let reader: ReadableStreamDefaultReader<T> | null = null;

  async function flush(controller: ReadableStreamDefaultController<R>) {
    try {
      while (controller.desiredSize > 0 && reader != null) {
        const next = await reader.read();
        if (next.done) {
          controller.close();
          if (reader) {
            reader.releaseLock();
            reader = null;
          }
          return;
        } else {
          try {
            const mapped = select(next.value);
            if (mapped !== undefined) {
              controller.enqueue(mapped);
            }
          } catch (err) {
            controller.error(err);
            return;
          }
        }
      }
    } catch (err) {
      controller.error(err);
      // Cleanup on error
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

  return function (src: ReadableStream<T>, opts?: { highWaterMark?: number }) {
    return new ReadableStream<R>({
      start(controller) {
        reader = src.getReader();
        return flush(controller);
      },
      pull(controller) {
        return flush(controller);
      },
      cancel(reason?: any) {
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
    }, opts);
  };
}