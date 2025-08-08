/**
 * Counts the number of values emitted by the source stream and emits the total count
 * when the source completes. Optionally counts only values that match a predicate.
 * 
 * @template T The type of values in the stream
 * @param predicate Optional function to determine which values to count
 * @returns A stream operator that emits the count when source completes
 * 
 * @example
 * ```typescript
 * // Count all values
 * pipe(
 *   from([1, 2, 3, 4, 5]),
 *   count()
 * )
 * // Emits: 5
 * 
 * // Count with predicate
 * pipe(
 *   from([1, 2, 3, 4, 5]),
 *   count(x => x % 2 === 0)
 * )
 * // Emits: 2 (counts even numbers: 2, 4)
 * 
 * // Count user actions
 * pipe(
 *   userEvents,
 *   count(event => event.type === 'click')
 * )
 * // Emits total click count when stream completes
 * ```
 */
export function count<T>(
  predicate?: (value: T, index: number) => boolean
): (src: ReadableStream<T>, opts?: { highWaterMark?: number }) => ReadableStream<number> {
  return function (src: ReadableStream<T>, { highWaterMark = 16 } = {}) {
    let reader: ReadableStreamDefaultReader<T> = null;
    let counter = 0;
    let index = 0;
    const shouldCount = predicate || (() => true);

    async function flush(controller: ReadableStreamDefaultController<number>) {
      try {
        while (reader != null) {
          let { done, value } = await reader.read();
          
          if (done) {
            // Source completed, emit the count
            controller.enqueue(counter);
            controller.close();
            return;
          }

          // Check if this value should be counted
          if (shouldCount(value, index++)) {
            counter++;
          }
        }
      } catch (err) {
        controller.error(err);
      }
    }

    return new ReadableStream<number>({
      async start(controller) {
        reader = src.getReader();
        await flush(controller);
      },
      async pull(controller) {
        await flush(controller);
      },
      cancel() {
        if (reader) {
          reader.releaseLock();
          reader = null;
        }
      }
    }, { highWaterMark });
  };
}
