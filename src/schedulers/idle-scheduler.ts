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
 * scheduler.schedule(() => {
 *   // Executes during idle time 
 * });
 * ```
 */
export class IdleScheduler implements IScheduler {
  declare schedule: (callback: () => void) => void;

  constructor() {
    // Determine the best scheduling method at construction time
    if (typeof globalThis !== 'undefined' && 
        globalThis.requestIdleCallback && 
        typeof globalThis.requestIdleCallback === 'function') {
      this.schedule = (callback) => globalThis.requestIdleCallback(callback);
    }
    // Fallback for Node.js and browsers without requestIdleCallback
    else if (typeof setImmediate !== 'undefined') {
      this.schedule = setImmediate;
    }
    // Final fallback using setTimeout
    else {
      this.schedule = (callback) => setTimeout(callback, 0);
    }
  }
}