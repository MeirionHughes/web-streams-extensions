import { IScheduler } from "../_scheduler.js";

/**
 * Creates a schedule operator that controls when stream chunks are enqueued using a scheduler.
 * This allows for controlling the timing and concurrency of stream processing,
 * useful for implementing backpressure or yielding control to other tasks.
 * 
 * @template T The type of values in the stream
 * @param scheduler The scheduler to use for controlling timing
 * @returns A transform function that can be used with pipe()
 * 
 * @example
 * ```typescript
 * import { IdleScheduler } from '../schedulers/idle-scheduler.js';
 * 
 * from([1, 2, 3, 4, 5])
 *   .pipe(
 *     schedule(new IdleScheduler()) // Yield control between items
 *   )
 * // Items are processed with idle-time yielding
 * ```
 */
export function schedule<T>(scheduler: IScheduler): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T> {
  let reader: ReadableStreamDefaultReader<T> | null = null;

  async function flush(controller: ReadableStreamDefaultController<T>) {
    try {
      while (controller.desiredSize > 0 && reader != null) {
        const next = await reader.read();
        if (next.done) {
          controller.close();
          if (reader) {
            reader.releaseLock();
            reader = null;
          }
          return;
        } else {
          try {
            // Use callback-based scheduling for precise timing control
            await new Promise<void>(resolve => {
              scheduler.schedule(resolve);
            });
            controller.enqueue(next.value);
          } catch (err) {
            controller.error(err);
            return;
          }
        }
      }
    } catch (err) {
      controller.error(err);
      // Cleanup on error
      if (reader) {
        try {
          await reader.cancel(err);
          reader.releaseLock();
        } catch (e) {
          // Ignore cleanup errors
        }
        reader = null;
      }
    }
  }

  return function (src: ReadableStream<T>, strategy: QueuingStrategy<T> = { highWaterMark: 16 }) {
    if (!scheduler || typeof scheduler.schedule !== 'function') {
      throw new Error('Invalid scheduler provided to schedule operator');
    }

    return new ReadableStream<T>({
      start(controller) {
        reader = src.getReader();
        return flush(controller);
      },
      pull(controller) {
        return flush(controller);
      },
      cancel(reason?: any) {
        if (reader) {
          try {
            reader.cancel(reason).catch(() => {
              // Ignore cancel errors
            });
            reader.releaseLock();
          } catch (err) {
            // Ignore cleanup errors
          } finally {
            reader = null;
          }
        }
      }
    }, strategy);
  };
}