/**
 * Concatenates multiple ReadableStreams together in sequence.
 * Each stream is read to completion before moving to the next stream.
 * Streams are not read until the resulting stream is read from, ensuring lazy evaluation.
 * 
 * @template T The type of values emitted by the streams
 * @param streams The streams to concatenate in order
 * @returns A ReadableStream that emits all values from the input streams in sequence
 * @throws Error if no streams are provided
 * 
 * @example
 * ```typescript
 * let inputA = [1, 2];
 * let inputB = [3, 4];
 * let expected = [1, 2, 3, 4];
 * let stream = toConcatenated(from(inputA), from(inputB));
 * let result = await toArray(stream);
 * ```
 */
export function toConcatenated<T>(...streams: ReadableStream<T>[]): ReadableStream<T>{
  if(streams.length == 0) throw new Error("must pass at least 1 stream to toConcatenated");
  
  let reader: ReadableStreamDefaultReader<T> = null;

  async function flush(controller: ReadableStreamDefaultController<T>) {
    try {      
      if(reader == null) { 
        if(streams.length == 0){
          controller.close();
          return;     
        }
        reader = streams.shift().getReader();
      }

      while (controller.desiredSize > 0 && reader != null) {
        let next = await reader.read();
        // if the current reader is exhausted... 
        if(next.done){
          reader.releaseLock();
          reader = null;
          // Recursively handle the next stream
          return flush(controller);
        } else {
          controller.enqueue(next.value);
        }
      }
    } catch (err) {
      controller.error(err);
      if (reader) {
        try {
          reader.releaseLock();
        } catch (e) {
          // Ignore cleanup errors
        }
        reader = null;
      }
    }
  }

  return new ReadableStream<T>({
    async start(controller) {
      return flush(controller);
    },
    async pull(controller) {
      return flush(controller);
    },
    cancel(reason?: any) {
      if(reader){
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
  });
}