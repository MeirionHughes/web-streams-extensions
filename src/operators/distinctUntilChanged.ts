/**
 * Only emits when the current value is different from the previous value.
 * Uses strict equality (===) by default, or a custom comparison function.
 * 
 * @template T The type of elements in the stream
 * @param compare Optional comparison function, defaults to strict equality
 * @returns A stream operator that filters out consecutive duplicate values
 * 
 * @example
 * ```typescript
 * pipe(
 *   from([1, 1, 2, 2, 2, 3, 1]),
 *   distinctUntilChanged()
 * )
 * // Emits: 1, 2, 3, 1
 * ```
 */
export function distinctUntilChanged<T>(
  compare?: (previous: T, current: T) => boolean
): (src: ReadableStream<T>, opts?: { highWaterMark?: number }) => ReadableStream<T> {
  return function (src: ReadableStream<T>, { highWaterMark = 16 } = {}) {
    let reader: ReadableStreamDefaultReader<T> = null;
    let hasValue = false;
    let previousValue: T;
    
    const compareFn = compare || ((a: T, b: T) => a === b);

    async function flush(controller: ReadableStreamDefaultController<T>) {
      try {
        while (controller.desiredSize > 0 && reader != null) {
          let { done, value } = await reader.read();
          
          if (done) {
            controller.close();
            return;
          }

          // First value is always emitted
          if (!hasValue) {
            hasValue = true;
            previousValue = value;
            controller.enqueue(value);
          } else if (!compareFn(previousValue, value)) {
            // Only emit if different from previous
            previousValue = value;
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
    }, { highWaterMark });
  };
}
