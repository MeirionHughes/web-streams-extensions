export interface ThrottleConfig {
  /**
   * If `true`, the resulting stream will emit the first value from the source instantly 
   * and trigger the timer immediately. the next value will be emitted after the timer expires. 
   * additional values read during the timer will be ignored. 
   * If `false`, it will not emit immediately, but will instead trigger the timer to
   * start the "throttling" process, while queuing the first value to be emitted. 
   *
   * If not provided, defaults to: `true`.
   */
  leading?: boolean;

  /**
   * If 'true' and if the last-read value from the source was not emitted by the throttle, 
   * the last value will be appended to the output before completion. 
   * if 'false' and if the last value was received during a throttling event, 
   * the last value will be ignored. 
   * If not provided, defaults to: `false`.
   */
  trailing?: boolean;
}

/**
 * Emits a value from the source stream, then ignores subsequent source
 * values for `duration` milliseconds, then repeats this process.
 * 
 * Uses a decoupled consumer/producer pattern where consumption from source
 * runs independently from throttled emissions.
 */
export function throttleTime<T>(
  duration: number,
  config?: ThrottleConfig
): (src: ReadableStream<T>, opts?: { highWaterMark?: number }) => ReadableStream<T> {
  if (duration < 0) {
    throw new Error("Throttle duration must be non-negative");
  }

  const { leading = true, trailing = false } = config || {};

  return function(src: ReadableStream<T>, opts?: { highWaterMark?: number }) {
    // Special case: if both leading and trailing are false, emit nothing
    if (!leading && !trailing) {
      return new ReadableStream<T>({
        async start(controller) {
          // Consume the source but emit nothing
          const reader = src.getReader();
          try {
            while (true) {
              const { done } = await reader.read();
              if (done) break;
            }
            controller.close();
          } catch (err) {
            controller.error(err);
          } finally {
            reader.releaseLock();
          }
        }
      }, { highWaterMark: opts?.highWaterMark ?? 16 });
    }

    let sourceReader: ReadableStreamDefaultReader<T> | null = null;
    let isThrottling = false;
    let lastValue: T | undefined = undefined;
    let hasLastValue = false;
    let isSourceComplete = false;
    let sourceError: any = null;
    let throttleTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    
    // Queue for emission control
    const emissionQueue: T[] = [];

    function clearThrottleTimer() {
      if (throttleTimer !== null) {
        clearTimeout(throttleTimer);
        throttleTimer = null;
      }
    }

    function enqueueValue(value: T) {
      emissionQueue.push(value);
    }

    function dequeueValue(): T | undefined {
      return emissionQueue.shift();
    }

    function hasQueuedValue(): boolean {
      return emissionQueue.length > 0;
    }

    function startThrottleWindow() {
      isThrottling = true;
      clearThrottleTimer();
      
      if (duration === 0) {
        // Zero duration means immediate release
        setTimeout(() => {
          isThrottling = false;
          // Check if we should emit trailing value
          if (trailing && hasLastValue && !cancelled) {
            enqueueValue(lastValue!);
            hasLastValue = false;
          }
        }, 0);
        return;
      }
      
      throttleTimer = setTimeout(() => {
        throttleTimer = null;
        isThrottling = false;
        
        // Check if we should emit trailing value
        if (trailing && hasLastValue && !cancelled) {
          enqueueValue(lastValue!);
          hasLastValue = false;
        }
      }, duration);
    }

    // Consumer: reads from source independently
    async function consumeSource() {
      try {
        sourceReader = src.getReader();
        
        while (!cancelled) {
          const { done, value } = await sourceReader.read();
          
          if (done) {
            isSourceComplete = true;
            break;
          }

          // Update last value for potential trailing emission
          lastValue = value;
          hasLastValue = true;

          // Handle value based on throttle state
          if (!isThrottling) {
            // Not throttling - can emit leading value
            if (leading) {
              enqueueValue(value);
              hasLastValue = false; // This value will be emitted as leading
              
              if (duration === 0) {
                // Zero duration - all values pass through immediately
                isThrottling = false;
              } else {
                startThrottleWindow();
              }
            } else if (trailing) {
              // Leading false, trailing true - start throttling without emitting
              startThrottleWindow();
            }
          }
          // If throttling, value is just stored as lastValue for potential trailing emission
        }
      } catch (err) {
        sourceError = err;
      } finally {
        if (sourceReader) {
          sourceReader.releaseLock();
          sourceReader = null;
        }
      }
    }

    // Start consuming source immediately
    const consumerPromise = consumeSource();

    return new ReadableStream<T>({
      async start(controller) {
        // Initial pull to start the process
        return this.pull!(controller);
      },

      async pull(controller) {
        try {
          while (controller.desiredSize! > 0 && !cancelled) {
            // Check for source error
            if (sourceError) {
              throw sourceError;
            }

            // Check if we have a value to emit
            if (hasQueuedValue()) {
              const value = dequeueValue()!;
              controller.enqueue(value);
              continue;
            }

            // Check if source is complete
            if (isSourceComplete) {
              // Handle final trailing emission
              if (trailing && hasLastValue) {
                controller.enqueue(lastValue!);
                hasLastValue = false;
                continue;
              }
              controller.close();
              return;
            }

            // Wait a bit for state changes
            await new Promise<void>(resolve => setTimeout(() => resolve(), 1));
          }
        } catch (err) {
          controller.error(err);
        }
      },

      cancel(reason?: any) {
        cancelled = true;
        clearThrottleTimer();
        
        if (sourceReader) {
          sourceReader.cancel(reason).catch(() => {});
          sourceReader.releaseLock();
          sourceReader = null;
        }
      }
    }, { highWaterMark: opts?.highWaterMark ?? 16 });
  };
}
