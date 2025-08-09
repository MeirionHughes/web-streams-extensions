import { IScheduler } from "../_scheduler.js";

/**
 * A scheduler that uses requestAnimationFrame when available (in browser environments),
 * falling back to setTimeout for compatibility with Node.js and environments without RAF.
 * 
 * This scheduler synchronizes operations with the browser's rendering cycle,
 * typically running at 60fps (16.67ms intervals). It's ideal for animations,
 * visual updates, and operations that should be synchronized with screen refreshes.
 * 
 * @example
 * ```typescript
 * let scheduler = new FrameScheduler();
 * scheduler.schedule(() => {
 *   // Executes on next animation frame
 * });
 * ```
 */
export class FrameScheduler implements IScheduler {
  declare schedule: (callback: () => void) => void;

  constructor() {
    // Determine the best scheduling method at construction time
    if (typeof globalThis !== 'undefined' && 
        globalThis.requestAnimationFrame && 
        typeof globalThis.requestAnimationFrame === 'function') {
      this.schedule = (callback) => globalThis.requestAnimationFrame(callback);
    }
    // Fallback for Node.js and browsers without requestAnimationFrame
    else if (typeof setImmediate !== 'undefined') {
      this.schedule = setImmediate;
    }
    // Final fallback using setTimeout with 16ms delay (approximate 60fps)
    else {
      this.schedule = (callback) => setTimeout(callback, 16);
    }
  }
}
