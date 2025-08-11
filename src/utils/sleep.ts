/**
 * Creates a promise that resolves after the specified duration.
 * Useful for adding delays in async operations.
 * 
 * @param duration The duration to sleep in milliseconds
 * @returns A promise that resolves after the specified duration
 * 
 * @example
 * ```typescript
 * console.log('Before sleep');
 * await sleep(1000); // Wait 1 second
 * console.log('After sleep');
 * ```
 */
export function sleep(duration: number): Promise<void> {
  if (duration < 0) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => setTimeout(() => resolve(), duration));
}