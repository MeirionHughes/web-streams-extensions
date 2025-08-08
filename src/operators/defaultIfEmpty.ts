/**
 * Emits a default value if the source stream completes without emitting any values.
 * If the source stream emits any values, they are passed through unchanged.
 * 
 * @template T The type of values in the stream
 * @param defaultValue The value to emit if the source is empty
 * @returns A stream operator that provides a default value for empty streams
 * 
 * @example
 * ```typescript
 * // Empty stream gets default value
 * pipe(
 *   empty(),
 *   defaultIfEmpty('No data')
 * )
 * // Emits: 'No data'
 * 
 * // Non-empty stream passes through unchanged
 * pipe(
 *   from([1, 2, 3]),
 *   defaultIfEmpty(0)
 * )
 * // Emits: 1, 2, 3
 * 
 * // Useful for fallback values
 * pipe(
 *   userPreferences.pipe(filter(p => p.theme)),
 *   defaultIfEmpty({ theme: 'default' })
 * )
 * ```
 */
export function defaultIfEmpty<T>(defaultValue: T): (
  src: ReadableStream<T>, 
  opts?: { highWaterMark?: number }
) => ReadableStream<T> {
  return function (src: ReadableStream<T>, { highWaterMark = 16 } = {}) {
    let reader: ReadableStreamDefaultReader<T> = null;
    let hasEmitted = false;

    async function flush(controller: ReadableStreamDefaultController<T>) {
      try {
        while (controller.desiredSize > 0 && reader != null) {
          let { done, value } = await reader.read();
          
          if (done) {
            // Source completed
            if (!hasEmitted) {
              // No values were emitted, emit default
              controller.enqueue(defaultValue);
            }
            controller.close();
            return;
          }

          // Source emitted a value
          hasEmitted = true;
          controller.enqueue(value);
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
