/**
 * Prepends the specified values to the beginning of the source stream.
 * 
 * @template T The type of elements in the stream
 * @param values Values to prepend to the stream
 * @returns A stream operator that starts with the given values
 * 
 * @example
 * ```typescript
 * pipe(
 *   from([3, 4, 5]),
 *   startWith(1, 2)
 * )
 * // Emits: 1, 2, 3, 4, 5
 * ```
 */
export function startWith<T>(
  ...values: T[]
): (src: ReadableStream<T>, opts?: { highWaterMark?: number }) => ReadableStream<T> {
  return function (src: ReadableStream<T>, { highWaterMark = 16 } = {}) {
    let reader: ReadableStreamDefaultReader<T> = null;
    let valuesEmitted = false;

    async function flush(controller: ReadableStreamDefaultController<T>) {
      try {
        // First emit the starting values
        if (!valuesEmitted) {
          valuesEmitted = true;
          for (const value of values) {
            controller.enqueue(value);
          }
        }

        // Then emit from source
        while (controller.desiredSize > 0 && reader != null) {
          let { done, value } = await reader.read();
          
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
    }, { highWaterMark });
  };
}
