/**
 * Ignores all source values but allows completion and error signals to pass through.
 * Useful when you only care about the completion/error state of a stream.
 * 
 * @template T The type of values in the source stream (ignored)
 * @returns A stream operator that ignores all values but preserves completion/error
 * 
 * @example
 * ```typescript
 * // Wait for operation to complete, ignore intermediate values
 * pipe(
 *   uploadProgress, // Emits: 10%, 25%, 50%, 75%, 100%
 *   ignoreElements()
 * )
 * // Emits nothing, but completes when upload finishes
 * 
 * // Combine with other operators to just wait for completion
 * pipe(
 *   someOperation,
 *   ignoreElements(),
 *   startWith('Operation completed!')
 * )
 * // Emits: 'Operation completed!' when someOperation finishes
 * ```
 */
export function ignoreElements<T>(): (
  src: ReadableStream<T>,
  strategy?: QueuingStrategy<never>
) => ReadableStream<never> {
  return function (src: ReadableStream<T>, strategy: QueuingStrategy<never> = { highWaterMark: 16 }) {
    let reader: ReadableStreamDefaultReader<T> = null;

    async function flush(controller: ReadableStreamDefaultController<never>) {
      try {
        while (reader != null) {
          let { done } = await reader.read();
          
          if (done) {
            controller.close();
            return;
          }
          
          // Ignore the value, continue reading
        }
      } catch (err) {
        controller.error(err);
      }
    }

    return new ReadableStream<never>({
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
