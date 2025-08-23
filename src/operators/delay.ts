import { sleep } from "../utils/sleep.js";

/**
 * Delays the the src read events by a specified amount of time.
 * Each value is delayed by the same duration.
 * 
 * @param duration The delay in milliseconds
 * @returns A stream operator that delays emissions
 * 
 * @example
 * ```typescript
 * pipe(
 *   from([1, 2, 3]),
 *   delay(1000)
 * )
 * // Each value is delayed by 1 second from its original emission time
 * 
 * // Useful for animations or rate limiting
 * pipe(
 *   userClicks,
 *   delay(200) // 200ms delay for debounce-like behavior
 * )
 * ```
 */
export function delay<T>(duration: number): (
  src: ReadableStream<T>,
  strategy?: QueuingStrategy<T>
) => ReadableStream<T> {
  if (duration < 0) {
    throw new Error("Delay duration must be non-negative");
  }

  return function (src: ReadableStream<T>, strategy: QueuingStrategy<T> = { highWaterMark: 16 }) {
    let reader: ReadableStreamDefaultReader<T> = null;

    async function flush(controller: ReadableStreamDefaultController<T>) {
      try {
        while (controller.desiredSize > 0 && reader != null) {
          let { done, value } = await reader.read();

          await sleep(duration);

          if (done) {
            controller.close();
            return;
          }
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
    }, strategy);
  };
}
