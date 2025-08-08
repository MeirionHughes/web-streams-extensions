/**
 * Applies an accumulator function to each value and emits intermediate results.
 * Like Array.reduce but emits each intermediate accumulated value.
 * 
 * @template T The input type
 * @template R The accumulated type
 * @param accumulator Function that combines the accumulation with the current value
 * @param seed Initial value for the accumulation
 * @returns A stream operator that emits accumulated values
 * 
 * @example
 * ```typescript
 * pipe(
 *   from([1, 2, 3, 4]),
 *   scan((acc, val) => acc + val, 0)
 * )
 * // Emits: 0, 1, 3, 6, 10
 * ```
 */
export function scan<T, R = T>(
  accumulator: (acc: R, value: T, index: number) => R | Promise<R>,
  seed: R
): (src: ReadableStream<T>, opts?: { highWaterMark?: number }) => ReadableStream<R> {
  return function (src: ReadableStream<T>, { highWaterMark = 16 } = {}) {
    let reader: ReadableStreamDefaultReader<T> = null;
    let acc = seed;
    let index = 0;
    let seedEmitted = false;

    async function flush(controller: ReadableStreamDefaultController<R>) {
      try {
        // Emit seed value first
        if (!seedEmitted && controller.desiredSize > 0) {
          seedEmitted = true;
          controller.enqueue(acc);
        }

        while (controller.desiredSize > 0 && reader != null) {
          let { done, value } = await reader.read();
          
          if (done) {
            controller.close();
            return;
          }

          acc = await accumulator(acc, value, index++);
          controller.enqueue(acc);
        }
      } catch (err) {
        controller.error(err);
      }
    }

    return new ReadableStream<R>({
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
