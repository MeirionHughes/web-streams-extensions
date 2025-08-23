/**
 * Buffers elements from the source stream and emits them as arrays when the buffer reaches the specified count.
 * The final buffer (if not empty) is emitted when the source stream completes.
 * 
 * @template T The type of elements to buffer
 * @param count The number of elements to buffer before emitting
 * @returns A stream operator that buffers elements into arrays
 * 
 * @example
 * ```typescript
 * let input = [1, 2, 3, 4];
 * let expected = [[1, 2], [3, 4]];
 * let stream = buffer(2)(from(input));
 * let result = await toArray(stream);
 * ```
 */
export function buffer<T>(count: number): (src: ReadableStream<T>, strategy?: QueuingStrategy<T[]>) => ReadableStream<T[]> {
  if (count <= 0) {
    throw new Error("Buffer count must be greater than 0");
  }

  return function (src: ReadableStream<T>, strategy: QueuingStrategy<T[]> = { highWaterMark: 16 }) {
    let reader: ReadableStreamDefaultReader<T> = null;
    let buffer: T[] = [];

    async function flush(controller: ReadableStreamDefaultController<T[]>) {
      try {
        while (controller.desiredSize > 0 && reader != null) {
          let next = await reader.read();
          if (next.done) {
            // Emit final buffer if it has elements
            if (buffer.length > 0) {
              controller.enqueue(buffer);
              buffer = [];
            }
            controller.close();
            if (reader) {
              reader.releaseLock();
              reader = null;
            }
          } else {
            buffer.push(next.value);
            // Emit buffer when it reaches the target count
            if (buffer.length >= count) {
              controller.enqueue(buffer);
              buffer = [];
            }
          }
        }
      } catch (err) {
        controller.error(err);
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

    return new ReadableStream<T[]>({
      start(controller) {
        reader = src.getReader();
        return flush(controller);
      },
      pull(controller) {
        return flush(controller);
      },
      async cancel(reason?: any) {
        if (reader) {
          try {
            await reader.cancel(reason);
            reader.releaseLock();
          } catch (err) {
            // Ignore cleanup errors
          } finally {
            reader = null;
          }
        }
      }
    }, strategy);
  }
}