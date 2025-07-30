import { IScheduler } from "../_scheduler.js";

/**
 * A scheduler that uses requestIdleCallback when available (in browser environments),
 * falling back to setTimeout for compatibility with Node.js and older browsers.
 * 
 * This scheduler yields control during idle periods, allowing other tasks to run
 * while maintaining good performance characteristics.
 * 
 * @example
 * ```typescript
 * let scheduler = new IdleScheduler();
 * await scheduler.nextTick(); // Yields to other tasks
 * ```
 */
export class IdleScheduler implements IScheduler {
  /**
   * Yields control to allow other tasks to run, using the most appropriate
   * mechanism for the current environment.
   * 
   * @returns A promise that resolves when the scheduler allows continuation
   */
  async nextTick(): Promise<void> {
    return new Promise<void>((resolve) => {
      // Check for browser environment and requestIdleCallback support
      if (typeof globalThis !== 'undefined' && 
          globalThis.requestIdleCallback && 
          typeof globalThis.requestIdleCallback === 'function') {
        globalThis.requestIdleCallback(() => resolve());
      }
      // Fallback for Node.js and browsers without requestIdleCallback
      else if (typeof setImmediate !== 'undefined') {
        setImmediate(() => resolve());
      }
      // Final fallback using setTimeout
      else {
        setTimeout(() => resolve(), 0);
      }
    });
  }
}