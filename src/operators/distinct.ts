/**
 * Filters out duplicate values based on strict equality or a custom key selector.
 * Keeps track of all previously emitted values to ensure uniqueness.
 * 
 * @template T The type of values in the stream
 * @template K The type of the key used for comparison
 * @param keySelector Optional function to extract comparison key from values
 * @returns A stream operator that filters out duplicate values
 * 
 * @example
 * ```typescript
 * // Simple distinct with primitive values
 * pipe(
 *   from([1, 2, 2, 3, 1, 4, 3]),
 *   distinct()
 * )
 * // Emits: 1, 2, 3, 4
 * 
 * // Distinct with key selector
 * pipe(
 *   from([
 *     { id: 1, name: 'John' },
 *     { id: 2, name: 'Jane' },
 *     { id: 1, name: 'John Doe' }, // Same id, filtered out
 *     { id: 3, name: 'Bob' }
 *   ]),
 *   distinct(person => person.id)
 * )
 * // Emits objects with ids: 1, 2, 3
 * ```
 */
export function distinct<T, K = T>(
  keySelector?: (value: T) => K
): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T> {
  return function (src: ReadableStream<T>, strategy: QueuingStrategy<T> = { highWaterMark: 16 }) {
    let reader: ReadableStreamDefaultReader<T> = null;
    const seenKeys = new Set<K>();
    const getKey = keySelector || ((value: T) => value as unknown as K);

    async function flush(controller: ReadableStreamDefaultController<T>) {
      try {
        while (controller.desiredSize > 0 && reader != null) {
          let { done, value } = await reader.read();
          
          if (done) {
            controller.close();
            return;
          }

          const key = getKey(value);
          
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            controller.enqueue(value);
          }
        }
      } catch (err) {
        controller.error(err);
      }
    }

    return new ReadableStream<T>({
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
        seenKeys.clear();
      }
    }, strategy);
  };
}
