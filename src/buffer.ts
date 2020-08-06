import { map } from "./map";


/**
 * buffer elements and then send an array to the reader. 
 * @param count elements to buffer before enqueue
 */
export function buffer<T>(count: number = 16): TransformStream<T, T[]> {
  let buffer = [];
  

  return new TransformStream({
    transform(chunk, controller) {
      buffer.push(chunk);
      if (buffer.length >= count) {
        controller.enqueue(buffer);
        buffer = [];
      }
    },
    flush(controller) {
      if (buffer.length > 0) {
        controller.enqueue(buffer);
      }
    }
  });
}