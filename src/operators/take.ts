
/**
 * Takes only the first `count` elements from the source stream.
 * After emitting the specified number of elements, the stream completes and the source is cancelled.
 * 
 * @template T The type of elements in the stream
 * @param count The number of elements to take
 * @param highWaterMark The high water mark for the output stream
 * @returns A stream operator that limits the number of elements
 * 
 * @example
 * ```typescript
 * let input = [1, 2, 3, 4, 5];
 * let expected = [1, 2, 3];
 * let stream = pipe(from(input), take(3));
 * let result = await toArray(stream);
 * ```
 */
export function take<T>(count: number, highWaterMark = 16): (src: ReadableStream<T>) => ReadableStream<T> {
  if (count < 0) {
    throw new Error("Take count must be non-negative");
  }
  
  return function (src: ReadableStream<T>) {
    let reader: ReadableStreamDefaultReader<T> = null;
    let taken = 0;

    async function flush(controller: ReadableStreamDefaultController<T>) {
      try {
        while (taken < count && controller.desiredSize > 0 && reader != null) {
          let next = await reader.read();
          if (next.done) {
            controller.close();
            reader.releaseLock();
            reader = null;
          } else {
            taken += 1;
            controller.enqueue(next.value);
            
            // If we've taken enough, close the stream
            if (taken >= count) {
              controller.close();
              if (reader) { 
                try {
                  reader.cancel();
                  reader.releaseLock();
                } catch (err) {
                  // Ignore cleanup errors
                }
              }
              reader = null;
              return;
            }
          }
        }
      } catch (err) {
        controller.error(err);
        if (reader) {
          try {
            reader.cancel(err);
            reader.releaseLock();
          } catch (e) {
            // Ignore cleanup errors
          }
          reader = null;
        }
      }
    }

    return new ReadableStream<T>({
      start(controller) {
        if (count === 0) {
          controller.close();
          return;
        }
        reader = src.getReader();
        return flush(controller);
      },
      pull(controller) {
        return flush(controller);
      },
      cancel(reason?: any) {
        if (reader) {
          try {
            reader.cancel(reason);
            reader.releaseLock();
          } catch (err) {
            // Ignore cleanup errors
          } finally {
            reader = null;
          }
        }
      }
    }, { highWaterMark });
  }
}