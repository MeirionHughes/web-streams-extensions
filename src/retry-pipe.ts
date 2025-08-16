import { Op } from "./_op.js";
import { isTransform } from "./utils/is-transform.js";
import { through } from "./operators/through.js";

/**
 * Options for retry pipe operations.
 */
export interface RetryPipeOptions {
  /** Maximum number of retry attempts (default: 3) */
  retries?: number;
  /** Delay between retries in milliseconds */
  delay?: number;
  /** High water mark for the stream */
  highWaterMark?: number;
}

/**
 * Creates a retry pipe that can recreate the entire stream pipeline on error.
 * Unlike regular streams, this allows for retry semantics by recreating the source stream
 * and reapplying all operators.
 * 
 * @template T The input stream type
 * @template R The output stream type
 * @param streamFactory Function that creates a new source stream for each attempt
 * @param operators Stream operators to apply to each attempt
 * @returns A ReadableStream that handles retries internally
 * 
 * @example
 * ```typescript
 * const result = retryPipe(
 *   () => fetchDataStream(),
 *   map(x => x * 2),
 *   filter(x => x > 10),
 *   { retries: 3, delay: 1000 }
 * );
 * ```
 */
export function retryPipe<T>(
  streamFactory: () => ReadableStream<T>,
  options?: RetryPipeOptions
): ReadableStream<T>;

export function retryPipe<T, R1>(
  streamFactory: () => ReadableStream<T>,
  op1: Op<T, R1> | RetryPipeOptions
): ReadableStream<R1>;

export function retryPipe<T, R1, R2=R1>(
  streamFactory: () => ReadableStream<T>,
  op1: Op<T, R1>,
  op2: Op<R1, R2> | RetryPipeOptions
): ReadableStream<R2>;

export function retryPipe<T, R1, R2, R3=R2>(
  streamFactory: () => ReadableStream<T>,
  op1: Op<T, R1>,
  op2: Op<R1, R2>,
  op3: Op<R2, R3> | RetryPipeOptions
): ReadableStream<R3>;

export function retryPipe<T, R1, R2, R3, R4=R3>(
  streamFactory: () => ReadableStream<T>,
  op1: Op<T, R1>,
  op2: Op<R1, R2>,
  op3: Op<R2, R3>,
  op4: Op<R3, R4> | RetryPipeOptions
): ReadableStream<R4>;

export function retryPipe<T, R1, R2, R3, R4, R5=R4>(
  streamFactory: () => ReadableStream<T>,
  op1: Op<T, R1>,
  op2: Op<R1, R2>,
  op3: Op<R2, R3>,
  op4: Op<R3, R4>,
  op5: Op<R4, R5> | RetryPipeOptions
): ReadableStream<R5>;

export function retryPipe<T, R1, R2, R3, R4, R5, R6=R5>(
  streamFactory: () => ReadableStream<T>,
  op1: Op<T, R1>,
  op2: Op<R1, R2>,
  op3: Op<R2, R3>,
  op4: Op<R3, R4>,
  op5: Op<R4, R5>,
  op6: Op<R5, R6> | RetryPipeOptions
): ReadableStream<R6>;

export function retryPipe<T, R1, R2, R3, R4, R5, R6, R7=R6>(
  streamFactory: () => ReadableStream<T>,
  op1: Op<T, R1>,
  op2: Op<R1, R2>,
  op3: Op<R2, R3>,
  op4: Op<R3, R4>,
  op5: Op<R4, R5>,
  op6: Op<R5, R6>,
  op7: Op<R6, R7> | RetryPipeOptions
): ReadableStream<R7>;

export function retryPipe<T, R1, R2, R3, R4, R5, R6, R7, R8=R7>(
  streamFactory: () => ReadableStream<T>,
  op1: Op<T, R1>,
  op2: Op<R1, R2>,
  op3: Op<R2, R3>,
  op4: Op<R3, R4>,
  op5: Op<R4, R5>,
  op6: Op<R5, R6>,
  op7: Op<R6, R7>,
  op8: Op<R7, R8> | RetryPipeOptions
): ReadableStream<R8>;

export function retryPipe<T, R1, R2, R3, R4, R5, R6, R7, R8, R9=R8>(
  streamFactory: () => ReadableStream<T>,
  op1: Op<T, R1>,
  op2: Op<R1, R2>,
  op3: Op<R2, R3>,
  op4: Op<R3, R4>,
  op5: Op<R4, R5>,
  op6: Op<R5, R6>,
  op7: Op<R6, R7>,
  op8: Op<R7, R8>,
  op9: Op<R8, R9> | RetryPipeOptions
): ReadableStream<R9>;

export function retryPipe<T, R1, R2, R3, R4, R5, R6, R7, R8, R9, R10=R9>(
  streamFactory: () => ReadableStream<T>,
  op1: Op<T, R1>,
  op2: Op<R1, R2>,
  op3: Op<R2, R3>,
  op4: Op<R3, R4>,
  op5: Op<R4, R5>,
  op6: Op<R5, R6>,
  op7: Op<R6, R7>,
  op8: Op<R7, R8>,
  op9: Op<R8, R9>,
  op10: Op<R9, R10> | RetryPipeOptions
): ReadableStream<R10>;

export function retryPipe(
  streamFactory: () => ReadableStream<any>,
  ...args: any[]
): ReadableStream<any> {
  // Extract options from the end of arguments if present
  let options: RetryPipeOptions = {};
  let operators: any[] = args;

  // Check if last argument is options
  const lastArg = args[args.length - 1];
  if (lastArg && typeof lastArg === 'object' && !lastArg.readable && !lastArg.writable && typeof lastArg.pipeThrough !== 'function') {
    options = lastArg;
    operators = args.slice(0, -1);
  }

  const { retries = 3, delay, highWaterMark = 1 } = options;

  let reader: ReadableStreamDefaultReader<any> | null = null;
  let attempts = 0;
  let cancelled = false;
  let currentTimer: NodeJS.Timeout | null = null;

  async function cleanupReader() {
    if (reader) {
      try {
        await reader.cancel();
      } catch (e) {
        // Ignore cancel errors
      }
      try {
        reader.releaseLock();
      } catch (e) {
        // Ignore release errors
      }
      reader = null;
    }
  }

  function clearTimer() {
    if (currentTimer) {
      clearTimeout(currentTimer);
      currentTimer = null;
    }
  }

  async function createStreamAndReader() {
    await cleanupReader();
    
    if (cancelled) {
      return;
    }

    attempts++;
    
    // Create a new stream and apply operators
    const sourceStream = streamFactory();
    let resultStream: ReadableStream<any> = sourceStream;
    
    // Apply operators using the same pattern as pipe.ts
    resultStream = operators
      .map(x => isTransform(x) ? through(x) : x)
      .reduce((stream, operator) => {
        return operator(stream, { highWaterMark });
      }, resultStream);
    
    reader = resultStream.getReader();
  }

  async function tryWithRetry(controller: ReadableStreamDefaultController<any>): Promise<void> {
    let lastError: any;
    const maxAttempts = retries + 1; // retries is additional attempts after initial
    
    while (attempts < maxAttempts && !cancelled) {
      try {
        await createStreamAndReader();
        
        // Read all values from the stream
        while (!cancelled && reader) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            await cleanupReader();
            return;
          }
          if (!cancelled) {
            controller.enqueue(value);
          }
        }
        return; // Success
        
      } catch (error) {
        lastError = error;
        await cleanupReader();
        
        if (attempts >= maxAttempts || cancelled) {
          break;
        }
        
        // Wait before retry if delay is specified
        if (delay && !cancelled) {
          await new Promise<void>((resolve, reject) => {
            currentTimer = setTimeout(() => {
              currentTimer = null;
              resolve();
            }, delay);
          });
        }
      }
    }
    
    // All retries failed or cancelled
    if (!cancelled) {
      controller.error(lastError || new Error("Cancelled"));
    }
  }

  return new ReadableStream({
    async start(controller) {
      try {
        await tryWithRetry(controller);
      } catch (error) {
        if (!cancelled) {
          controller.error(error);
        }
      }
    },
    async pull(controller) {
      // Pull is handled in start() for retry logic
    },
    async cancel(reason?: any) {
      cancelled = true;
      clearTimer();
      await cleanupReader();
    }
  }, { highWaterMark });
}

/**
 * Creates a retry pipe that validates the stream factory and operators work correctly.
 * This version attempts to create and apply operators without consuming the stream,
 * then returns a proper retryPipe stream for actual use.
 * 
 * @template T The input stream type
 * @param streamFactory Function that creates a new source stream for each attempt
 * @param operators Stream operators to apply to each attempt
 * @returns A promise that resolves to a retry-enabled stream
 */
export async function retryPipeValidated<T>(
  streamFactory: () => ReadableStream<T>,
  ...args: any[]
): Promise<ReadableStream<T>> {
  // Extract options from the end of arguments if present
  let options: RetryPipeOptions = {};
  let operators: any[] = args;

  const lastArg = args[args.length - 1];
  if (lastArg && typeof lastArg === 'object' && !lastArg.readable && !lastArg.writable) {
    options = lastArg;
    operators = args.slice(0, -1);
  }

  const { retries = 3, delay, highWaterMark = 1 } = options;
  let attempts = 0;
  let lastError: any;
  let currentTimer: NodeJS.Timeout | null = null;
  const maxAttempts = retries + 1; // retries is additional attempts after initial

  while (attempts < maxAttempts) {
    try {
      attempts++;
      
      // Validate that we can create the stream and apply operators without consuming
      const testStream = streamFactory();
      let validationStream: ReadableStream<any> = testStream;
      
      // Apply operators using the same pattern as pipe.ts
      validationStream = operators
        .map(x => isTransform(x) ? through(x) : x)
        .reduce((stream, operator) => {
          return operator(stream, { highWaterMark });
        }, validationStream);
      
      // Just verify we can get a reader without consuming
      const reader = validationStream.getReader();
      try {
        await reader.cancel(); // Properly cancel the test stream
      } catch (e) {
        // Ignore cancel errors
      }
      try {
        reader.releaseLock();
      } catch (e) {
        // Ignore release errors
      }
      
      // Validation succeeded, return a proper retryPipe
      return retryPipe(streamFactory, ...args);
      
    } catch (error) {
      lastError = error;
      
      if (attempts >= maxAttempts) {
        throw lastError;
      }
      
      // Wait before retry if delay is specified
      if (delay && attempts < maxAttempts) {
        await new Promise<void>((resolve) => {
          currentTimer = setTimeout(() => {
            currentTimer = null;
            resolve();
          }, delay);
        });
      }
    } finally {
      // Clean up any timer
      if (currentTimer) {
        clearTimeout(currentTimer);
        currentTimer = null;
      }
    }
  }

  throw lastError;
}
