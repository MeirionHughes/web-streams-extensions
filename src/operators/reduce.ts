/**
 * Applies an accumulator function to each value and emits only the final result.
 * Like Array.reduce but for streams - only emits when the source stream completes.
 * 
 * @template T The input type
 * @template R The accumulated type
 * @param accumulator Function that combines the accumulation with the current value
 * @param seed Initial value for the accumulation
 * @returns A stream operator that emits the final accumulated value
 * 
 * @example
 * ```typescript
 * pipe(
 *   from([1, 2, 3, 4]),
 *   reduce((acc, val) => acc + val, 0)
 * )
 * // Emits: 10 (only when source completes)
 * ```
 */
export function reduce<T, R = T>(
  accumulator: (acc: R, value: T, index: number) => R | Promise<R>,
  seed: R
): (src: ReadableStream<T>, strategy?: QueuingStrategy<R>) => ReadableStream<R> {
  return function (src: ReadableStream<T>, strategy: QueuingStrategy<R> = { highWaterMark: 16 }) {
    let reader: ReadableStreamDefaultReader<T> = null;
    let acc = seed;
    let index = 0;

    async function consume(controller: ReadableStreamDefaultController<R>) {
      try {
        while (reader != null) {
          let { done, value } = await reader.read();
          
          if (done) {
            // Only emit the final accumulated value when source completes
            controller.enqueue(acc);
            controller.close();
            return;
          }

          acc = await accumulator(acc, value, index++);
        }
      } catch (err) {
        controller.error(err);
      }
    }

    return new ReadableStream<R>({
      async start(controller) {
        reader = src.getReader();
        await consume(controller);
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
