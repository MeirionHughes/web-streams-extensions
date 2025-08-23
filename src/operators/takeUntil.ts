/**
 * Takes values from the source until the notifier stream emits a value.
 * When the notifier emits, the source stream is cancelled and the output completes.
 * 
 * @template T The type of elements in the source stream
 * @template U The type of elements in the notifier stream (can be any type)
 * @param notifier Stream that signals when to stop taking from source
 * @returns A stream operator that stops when notifier emits
 * 
 * @example
 * ```typescript
 * pipe(
 *   interval(100), // Emits every 100ms
 *   takeUntil(interval(1000)) // Stop after 1 second
 * )
 * // Will emit about 10 values before stopping
 * ```
 */
export function takeUntil<T, U = any>(
  notifier: ReadableStream<U>
): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T> {
  return function (src: ReadableStream<T>, strategy: QueuingStrategy<T> = { highWaterMark: 16 }) {
    let sourceReader: ReadableStreamDefaultReader<T> = null;
    let notifierReader: ReadableStreamDefaultReader<U> = null;
    let stopped = false;

    // Start listening to notifier immediately
    async function startNotifierWatch(controller: ReadableStreamDefaultController<T>) {
      try {
        const { done } = await notifierReader.read();
        if (!done && !stopped) {
          stopped = true;
          controller.close();
        }
      } catch (err) {
        // Notifier errored, but we continue with source
      }
    }

    async function flush(controller: ReadableStreamDefaultController<T>) {
      try {
        while (controller.desiredSize > 0 && sourceReader != null && !stopped) {
          const { done, value } = await sourceReader.read();
          
          if (done || stopped) {
            controller.close();
            return;
          }

          if (!stopped) {
            controller.enqueue(value);
          }
        }
        
        if (stopped) {
          controller.close();
        }
      } catch (err) {
        if (!stopped) {
          controller.error(err);
        }
      }
    }

    return new ReadableStream<T>({
      async start(controller) {
        sourceReader = src.getReader();
        notifierReader = notifier.getReader();
        
        // Start watching notifier asynchronously
        startNotifierWatch(controller);
        
        await flush(controller);
      },
      async pull(controller) {
        if (!stopped) {
          await flush(controller);
        }
      },
      cancel() {
        stopped = true;
        if (sourceReader) {
          sourceReader.releaseLock();
          sourceReader = null;
        }
        if (notifierReader) {
          notifierReader.releaseLock();
          notifierReader = null;
        }
      }
    }, strategy);
  };
}
