/**
 * Type guard to check if an object is a ReadableStream.
 * 
 * @param obj The object to test
 * @returns True if the object is a ReadableStream, false otherwise
 * 
 * @example
 * ```typescript
 * let stream = new ReadableStream();
 * if (isReadableStream(stream)) {
 *   // TypeScript knows stream is ReadableStream here
 *   let reader = stream.getReader();
 * }
 * ```
 */
export function isReadableStream(obj: any): obj is ReadableStream {
  return obj != null && 
         typeof obj === 'object' && 
         typeof obj.getReader === 'function' &&
         typeof obj.cancel === 'function' &&
         typeof obj.locked === 'boolean';
}