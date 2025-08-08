/**
 * Creates a ReadableStream that emits a single value after a specified delay,
 * or emits incremental numbers at regular intervals after an initial delay.
 * 
 * @param dueTime Initial delay in milliseconds before first emission
 * @param intervalDuration Optional interval in milliseconds for subsequent emissions
 * @returns A ReadableStream that emits after the specified timing
 * 
 * @example
 * ```typescript
 * // Single emission after 1 second
 * timer(1000)
 * // Emits: 0 (after 1 second, then completes)
 * 
 * // Start after 1 second, then emit every 500ms
 * timer(1000, 500)
 * // Emits: 0 (after 1s), 1 (after 1.5s), 2 (after 2s), 3 (after 2.5s), ...
 * 
 * // Immediate start, then interval
 * timer(0, 1000)
 * // Emits: 0 (immediately), 1 (after 1s), 2 (after 2s), ...
 * ```
 */
export function timer(dueTime: number, intervalDuration?: number): ReadableStream<number> {
  if (dueTime < 0) {
    throw new Error("Due time must be non-negative");
  }
  if (intervalDuration !== undefined && intervalDuration <= 0) {
    throw new Error("Interval duration must be positive");
  }

  let count = 0;
  let dueTimer: ReturnType<typeof setTimeout> | null = null;
  let intervalTimer: ReturnType<typeof setInterval> | null = null;

  return new ReadableStream<number>({
    start(controller) {
      // Set up initial delay
      dueTimer = setTimeout(() => {
        try {
          controller.enqueue(count++);
          
          // If interval is specified, set up recurring timer
          if (intervalDuration !== undefined) {
            intervalTimer = setInterval(() => {
              try {
                controller.enqueue(count++);
              } catch (err) {
                // Controller might be closed, clear timer
                if (intervalTimer) {
                  clearInterval(intervalTimer);
                  intervalTimer = null;
                }
              }
            }, intervalDuration);
          } else {
            // Single emission, complete the stream
            controller.close();
          }
        } catch (err) {
          // Controller might be closed, just clean up
          if (dueTimer) {
            clearTimeout(dueTimer);
            dueTimer = null;
          }
        }
      }, dueTime);
    },
    cancel() {
      if (dueTimer) {
        clearTimeout(dueTimer);
        dueTimer = null;
      }
      if (intervalTimer) {
        clearInterval(intervalTimer);
        intervalTimer = null;
      }
    }
  });
}
