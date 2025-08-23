/**
 * Only emits when the current value is different from the previous value, based on a specific key.
 * Uses strict equality (===) by default on the selected key, or a custom comparison function.
 * 
 * @template T The type of elements in the stream
 * @template K The key type
 * @param key The key to select from each item for comparison
 * @param compare Optional comparison function for the selected key values, defaults to strict equality
 * @returns A stream operator that filters out consecutive items with duplicate key values
 * 
 * @example
 * ```typescript
 * pipe(
 *   from([
 *     { id: 1, name: 'Alice' },
 *     { id: 1, name: 'Alice Updated' },
 *     { id: 2, name: 'Bob' },
 *     { id: 2, name: 'Bob Updated' },
 *     { id: 1, name: 'Alice Again' }
 *   ]),
 *   distinctUntilKeyChanged('id')
 * )
 * // Emits: { id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }, { id: 1, name: 'Alice Again' }
 * ```
 * 
 * @example
 * ```typescript
 * pipe(
 *   from([
 *     { name: 'Foo1' },
 *     { name: 'Foo2' },
 *     { name: 'Bar' },
 *     { name: 'Foo3' }
 *   ]),
 *   distinctUntilKeyChanged('name', (x, y) => x.substring(0, 3) === y.substring(0, 3))
 * )
 * // Emits: { name: 'Foo1' }, { name: 'Bar' }, { name: 'Foo3' }
 * ```
 */
export function distinctUntilKeyChanged<T, K extends keyof T>(
  key: K
): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T>;

export function distinctUntilKeyChanged<T, K extends keyof T>(
  key: K,
  compare: (x: T[K], y: T[K]) => boolean
): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T>;

export function distinctUntilKeyChanged<T, K extends keyof T>(
  key: K,
  compare?: (x: T[K], y: T[K]) => boolean
): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T> {
  return function (src: ReadableStream<T>, strategy: QueuingStrategy<T> = { highWaterMark: 16 }) {
    let reader: ReadableStreamDefaultReader<T> = null;
    let hasValue = false;
    let previousValue: T[K];
    
    const compareFn = compare || ((a: T[K], b: T[K]) => a === b);

    async function flush(controller: ReadableStreamDefaultController<T>) {
      try {
        while (controller.desiredSize > 0 && reader != null) {
          let { done, value } = await reader.read();
          
          if (done) {
            controller.close();
            return;
          }

          const currentKeyValue = value[key];

          // First value is always emitted
          if (!hasValue) {
            hasValue = true;
            previousValue = currentKeyValue;
            controller.enqueue(value);
          } else if (!compareFn(previousValue, currentKeyValue)) {
            // Only emit if key value is different from previous
            previousValue = currentKeyValue;
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
      }
    }, strategy);
  };
}
