/**
 * Emits the previous and current value as a pair (tuple) for each emission.
 * The first emission is skipped since there's no previous value.
 * 
 * @template T The type of values in the stream
 * @returns A stream operator that emits [previous, current] pairs
 * 
 * @example
 * ```typescript
 * pipe(
 *   from([1, 2, 3, 4, 5]),
 *   pairwise()
 * )
 * // Emits: [1, 2], [2, 3], [3, 4], [4, 5]
 * 
 * // Useful for detecting changes
 * pipe(
 *   userInput,
 *   pairwise(),
 *   filter(([prev, curr]) => prev !== curr),
 *   map(([prev, curr]) => ({ from: prev, to: curr }))
 * )
 * // Emits change objects when value actually changes
 * ```
 */
export function pairwise<T>(): (
  src: ReadableStream<T>, 
  strategy?: QueuingStrategy<[T, T]>
) => ReadableStream<[T, T]> {
  return function (src: ReadableStream<T>, strategy: QueuingStrategy<[T, T]> = { highWaterMark: 16 }) {
    let reader: ReadableStreamDefaultReader<T> = null;
    let hasPrevious = false;
    let previous: T;

    async function flush(controller: ReadableStreamDefaultController<[T, T]>) {
      try {
        while (controller.desiredSize > 0 && reader != null) {
          let { done, value } = await reader.read();
          
          if (done) {
            controller.close();
            return;
          }

          if (hasPrevious) {
            // Emit pair of [previous, current]
            controller.enqueue([previous, value]);
          } else {
            // First value - just store it, don't emit yet
            hasPrevious = true;
          }
          
          previous = value;
        }
      } catch (err) {
        controller.error(err);
      }
    }

    return new ReadableStream<[T, T]>({
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
