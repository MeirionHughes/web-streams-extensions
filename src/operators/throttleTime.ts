export interface ThrottleConfig {
  /**
   * If `true`, the very first value from the source will be emitted immediately.
   * If `false`, the very first value will trigger a window but not be emitted.
   *
   * If not provided, defaults to: `true`.
   */
  leading?: boolean;

  /**
   * If `true`, the very last value stored during a window will be emitted
   * when the stream ends (only if it hasn't already been emitted).
   * If `false`, the last stored value is not emitted when the stream ends.
   * 
   * If not provided, defaults to: `false`.
   */
  trailing?: boolean;
}

/**
 * Emits a value from the source stream, then ignores subsequent source
 * values for `duration` milliseconds, then repeats this process.
 * 
 * The operator has two states:
 * - window-not-active: emit values immediately and start window timer
 * - window-active: ignore everything but keep the last value during the window
 */
export function throttleTime<T>(
  duration: number,
  config?: ThrottleConfig
): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T> {
  if (duration < 0) {
    throw new Error("Throttle duration must be non-negative");
  }

  const { leading = true, trailing = false } = config || {};

  return function(src: ReadableStream<T>, strategy: QueuingStrategy<T> = { highWaterMark: 16 }) {
    let sourceReader: ReadableStreamDefaultReader<T> | null = null;
    let isWindowActive = false;
    let lastValueDuringWindow: T | undefined = undefined;
    let hasLastValueDuringWindow = false;
    let isSourceComplete = false;
    let sourceError: any = null;
    let windowTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let isVeryFirstValue = true;
    
    // Queue for emission control
    const emissionQueue: T[] = [];

    function clearWindowTimer() {
      if (windowTimer !== null) {
        clearTimeout(windowTimer);
        windowTimer = null;
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

    function startWindow() {
      isWindowActive = true;
      clearWindowTimer();
      
      if (duration === 0) {
        // Zero duration means immediate end of window
        setTimeout(() => {
          isWindowActive = false;
          // Don't clear hasLastValueDuringWindow - it should persist until stream ends
        }, 0);
        return;
      }
      
      windowTimer = setTimeout(() => {
        windowTimer = null;
        isWindowActive = false;
        // Don't clear hasLastValueDuringWindow - it should persist until stream ends
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

          // Handle very first value specially
          if (isVeryFirstValue) {
            isVeryFirstValue = false;
            
            if (leading) {
              // Emit very first value immediately
              enqueueValue(value);
              // Clear any stored value since we're emitting immediately
              hasLastValueDuringWindow = false;
              if (duration > 0) {
                startWindow();
              }
            } else {
              // Don't emit very first value, but start window
              lastValueDuringWindow = value;
              hasLastValueDuringWindow = true;
              if (duration > 0) {
                startWindow();
              }
            }
            continue;
          }

          // For all subsequent values
          if (!isWindowActive) {
            // window-not-active: emit value immediately and start window
            enqueueValue(value);
            // Clear any stored value since we're emitting immediately
            hasLastValueDuringWindow = false;
            if (duration > 0) {
              startWindow();
            }
          } else {
            // window-active: ignore everything but keep the last value
            lastValueDuringWindow = value;
            hasLastValueDuringWindow = true;
          }
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
              // Handle final trailing emission if applicable
              if (trailing && hasLastValueDuringWindow) {
                controller.enqueue(lastValueDuringWindow!);
                hasLastValueDuringWindow = false;
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
        clearWindowTimer();
        
        if (sourceReader) {
          sourceReader.cancel(reason).catch(() => {});
          sourceReader.releaseLock();
          sourceReader = null;
        }
      }
    }, strategy);
  };
}
