/**
 * Creates a ReadableStream that emits a sequence of numbers within a specified range.
 * 
 * @param start The starting number (inclusive)
 * @param count The number of sequential numbers to emit
 * @returns A ReadableStream that emits the number sequence
 * 
 * @example
 * ```typescript
 * // Numbers 1 through 5
 * range(1, 5)
 * // Emits: 1, 2, 3, 4, 5
 * 
 * // Numbers 0 through 3
 * range(0, 4)
 * // Emits: 0, 1, 2, 3
 * 
 * // Single number
 * range(10, 1)
 * // Emits: 10
 * 
 * // Empty range
 * range(5, 0)
 * // Emits nothing, completes immediately
 * ```
 */
export function range(start: number, count: number): ReadableStream<number> {
  if (count < 0) {
    throw new Error("Count must be non-negative");
  }

  let current = start;
  let remaining = count;

  return new ReadableStream<number>({
    start(controller) {
      // Handle empty range immediately
      if (remaining === 0) {
        controller.close();
        return;
      }
    },
    pull(controller) {
      try {
        if (remaining > 0) {
          controller.enqueue(current);
          current++;
          remaining--;
          
          if (remaining === 0) {
            controller.close();
          }
        }
      } catch (err) {
        controller.error(err);
      }
    }
  });
}
