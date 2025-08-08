import { Signal } from "../utils/signal.js";

/**
 * Limits the rate of emissions to at most one per specified time period.
 * The first value is emitted immediately, then subsequent values are ignored until the time period expires.
 * 
 * @template T The type of elements in the stream
 * @param duration The minimum time between emissions in milliseconds
 * @returns A stream operator that throttles emissions
 * 
 * @example
 * ```typescript
 * pipe(
 *   interval(100), // Emits every 100ms
 *   throttleTime(300) // Only emit every 300ms
 * )
 * // Will emit values at 0ms, 300ms, 600ms, etc.
 * ```
 */
export function throttleTime<T>(
  duration: number
): (src: ReadableStream<T>, opts?: { highWaterMark?: number }) => ReadableStream<T> {
  return function (src: ReadableStream<T>, { highWaterMark = 16 } = {}) {
    let reader: ReadableStreamDefaultReader<T> = null;
    let lastEmitTime = 0;
    let pendingValue: T | undefined;
    let hasPendingValue = false;
    let timeoutId: NodeJS.Timeout | number | null = null;
    let emitSignal = new Signal();

    function cleanup() {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (reader) {
        reader.releaseLock();
        reader = null;
      }
    }

    function scheduleEmission(controller: ReadableStreamDefaultController<T>) {
      if (timeoutId || !hasPendingValue) return;
      
      const now = Date.now();
      const timeUntilNextEmit = Math.max(0, duration - (now - lastEmitTime));
      
      timeoutId = setTimeout(() => {
        timeoutId = null;
        if (hasPendingValue && controller.desiredSize > 0) {
          try {
            controller.enqueue(pendingValue!);
            lastEmitTime = Date.now();
            hasPendingValue = false;
            emitSignal.signal(); // Signal that we've emitted
          } catch (err) {
            // Controller might be closed, ignore
          }
        }
      }, timeUntilNextEmit);
    }

    async function flush(controller: ReadableStreamDefaultController<T>) {
      try {
        while (controller.desiredSize > 0 && reader != null) {
          let { done, value } = await reader.read();
          
          if (done) {
            // Emit any final pending value
            if (hasPendingValue && controller.desiredSize > 0) {
              controller.enqueue(pendingValue!);
            }
            cleanup(); // Clean up before closing
            controller.close();
            return;
          }

          const currentTime = Date.now();
          
          if (lastEmitTime === 0 || (currentTime - lastEmitTime) >= duration) {
            // Can emit immediately
            controller.enqueue(value);
            lastEmitTime = currentTime;
            hasPendingValue = false;
            
            // Clear any pending timeout since we just emitted
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
          } else {
            // Store as pending value (replaces previous pending)
            pendingValue = value;
            hasPendingValue = true;
            
            // Schedule emission for when throttle period expires
            scheduleEmission(controller);
          }
        }
      } catch (err) {
        cleanup(); // Clean up on error
        controller.error(err);
      }
    }

    return new ReadableStream<T>({
      async start(controller) {
        reader = src.getReader();
        await flush(controller);
      },
      async pull(controller) {
        // If we have a pending emission scheduled, wait for it
        if (timeoutId && hasPendingValue) {
          await emitSignal.wait();
        }
        await flush(controller);
      },
      cancel() {
        cleanup();
      }
    }, { highWaterMark });
  };
}
