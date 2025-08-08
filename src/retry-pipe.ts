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

  // Return a ReadableStream that handles retries internally
  let reader: ReadableStreamDefaultReader<any> | null = null;
  let attempts = 0;

  async function createStreamAndReader() {
    if (reader) {
      try {
        reader.releaseLock();
      } catch (e) {
        // Ignore cleanup errors
      }
      reader = null;
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

  async function flush(controller: ReadableStreamDefaultController<any>) {
    try {
      while (controller.desiredSize > 0 && reader != null) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          if (reader) {
            reader.releaseLock();
            reader = null;
          }
          return;
        }
        controller.enqueue(value);
      }
    } catch (error) {
      // Handle errors during reading - retry if we haven't exceeded attempts
      if (attempts > retries) {
        controller.error(error);
        if (reader) {
          try {
            reader.cancel(error);
            reader.releaseLock();
          } catch (e) {
            // Ignore cleanup errors
          }
          reader = null;
        }
        return;
      }
      
      // Wait before retry if delay is specified
      if (delay && attempts <= retries) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      // Retry by creating a new stream
      await createStreamAndReader();
      await flush(controller);
    }
  }

  return new ReadableStream({
    async start(controller) {
      let lastError: any;
      
      while (attempts <= retries) {
        try {
          await createStreamAndReader();
          await flush(controller);
          return; // Success, exit the retry loop
        } catch (error) {
          lastError = error;
          
          if (attempts > retries) {
            controller.error(lastError);
            return;
          }
          
          // Wait before retry if delay is specified
          if (delay && attempts <= retries) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      // If we get here, all retries failed
      controller.error(lastError);
    },
    async pull(controller) {
      await flush(controller);
    },
    cancel(reason?: any) {
      if (reader) {
        try {
          reader.cancel(reason);
          reader.releaseLock();
        } catch (err) {
          // Ignore cleanup errors
        } finally {
          reader = null;
        }
      }
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

  while (attempts <= retries) {
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
      reader.releaseLock();
      
      // Validation succeeded, return a proper retryPipe
      return retryPipe(streamFactory, ...args);
      
    } catch (error) {
      lastError = error;
      
      if (attempts > retries) {
        throw lastError;
      }
      
      // Wait before retry if delay is specified
      if (delay && attempts <= retries) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
