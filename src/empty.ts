/**
 * Creates a ReadableStream that immediately completes without emitting any values.
 * Useful for conditional logic and as a base case in stream operations.
 * 
 * @template T The type of values the stream would emit (never actually emitted)
 * @returns A ReadableStream that completes immediately
 * 
 * @example
 * ```typescript
 * // Use in conditional logic
 * const stream = condition ? from([1, 2, 3]) : empty();
 * 
 * // Always completes immediately
 * const result = await toArray(empty()); // []
 * ```
 */
export function empty<T = never>(): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      controller.close();
    }
  });
}
