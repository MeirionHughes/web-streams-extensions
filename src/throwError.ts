/**
 * Creates a ReadableStream that immediately errors with the provided error.
 * Useful for conditional error scenarios and testing error handling.
 * 
 * @template T The type of values the stream would emit (never actually emitted)
 * @param error The error to emit, or a factory function that returns an error
 * @returns A ReadableStream that errors immediately
 * 
 * @example
 * ```typescript
 * // Simple error
 * const errorStream = throwError(new Error("Something went wrong"));
 * 
 * // Error factory
 * const dynamicError = throwError(() => new Error(`Error at ${Date.now()}`));
 * 
 * // Use in conditional logic
 * const stream = isValid ? from([1, 2, 3]) : throwError(new Error("Invalid state"));
 * ```
 */
export function throwError<T = never>(error: Error | (() => Error)): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      const errorToThrow = typeof error === 'function' ? error() : error;
      controller.error(errorToThrow);
    }
  });
}
