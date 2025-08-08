/**
 * Takes values while the predicate function returns true, then completes the stream.
 * Stops emitting as soon as the predicate returns false.
 * 
 * @template T The type of values in the stream
 * @param predicate Function that determines whether to continue taking values
 * @returns A stream operator that takes values while predicate is true
 * 
 * @example
 * ```typescript
 * // Take numbers while they're less than 3
 * pipe(
 *   from([1, 2, 3, 4, 5]),
 *   takeWhile(x => x < 3)
 * )
 * // Emits: 1, 2 (stops at 3)
 * 
 * // Take while condition is met
 * pipe(
 *   sensorReadings,
 *   takeWhile(reading => reading.temperature < 100),
 *   // Process readings until temperature reaches 100
 * )
 * ```
 */
export function takeWhile<T>(
  predicate: (value: T, index: number) => boolean
): (src: ReadableStream<T>, opts?: { highWaterMark?: number }) => ReadableStream<T> {
  return function (src: ReadableStream<T>, { highWaterMark = 16 } = {}) {
    let reader: ReadableStreamDefaultReader<T> = null;
    let index = 0;

    async function flush(controller: ReadableStreamDefaultController<T>) {
      try {
        while (controller.desiredSize > 0 && reader != null) {
          let { done, value } = await reader.read();
          
          if (done) {
            controller.close();
            return;
          }

          // Check if we should continue taking values
          if (predicate(value, index++)) {
            controller.enqueue(value);
          } else {
            // Predicate failed, complete the stream
            controller.close();
            return;
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
