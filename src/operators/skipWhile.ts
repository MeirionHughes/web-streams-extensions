/**
 * Skips values while the predicate function returns true, then emits all subsequent values.
 * Once the predicate returns false, all remaining values are emitted regardless of the predicate.
 * 
 * @template T The type of values in the stream
 * @param predicate Function that determines whether to skip a value
 * @returns A stream operator that skips values while predicate is true
 * 
 * @example
 * ```typescript
 * // Skip numbers while they're less than 3
 * pipe(
 *   from([1, 2, 3, 2, 4, 1, 5]),
 *   skipWhile(x => x < 3)
 * )
 * // Emits: 3, 2, 4, 1, 5 (skips initial 1, 2 but emits later ones)
 * 
 * // Skip while loading
 * pipe(
 *   appStates,
 *   skipWhile(state => state.loading),
 *   // Process all states after loading completes
 * )
 * ```
 */
export function skipWhile<T>(
  predicate: (value: T, index: number) => boolean
): (src: ReadableStream<T>, opts?: { highWaterMark?: number }) => ReadableStream<T> {
  return function (src: ReadableStream<T>, { highWaterMark = 16 } = {}) {
    let reader: ReadableStreamDefaultReader<T> = null;
    let isSkipping = true;
    let index = 0;

    async function flush(controller: ReadableStreamDefaultController<T>) {
      try {
        while (controller.desiredSize > 0 && reader != null) {
          let { done, value } = await reader.read();
          
          if (done) {
            controller.close();
            return;
          }

          if (isSkipping) {
            // Check if we should continue skipping
            if (predicate(value, index++)) {
              // Skip this value
              continue;
            } else {
              // Stop skipping from now on
              isSkipping = false;
            }
          }

          // Emit the value
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
