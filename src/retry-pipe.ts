import { Op } from "./_op.js";

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
  return new ReadableStream({
    async start(controller) {
      let attempts = 0;
      let lastError: any;

      while (attempts <= retries) {
        try {
          attempts++;
          
          // Create a new stream and apply operators
          const sourceStream = streamFactory();
          let resultStream: ReadableStream<any> = sourceStream;
          
          // Apply operators one by one
          for (const operator of operators) {
            if (typeof operator === 'function') {
              resultStream = operator(resultStream, { highWaterMark });
            } else if (operator && typeof operator.readable !== 'undefined' && typeof operator.writable !== 'undefined') {
              // TransformStream
              resultStream = resultStream.pipeThrough(operator);
            }
          }
          
          // Pipe the result stream to our controller
          const reader = resultStream.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                controller.close();
                return;
              }
              controller.enqueue(value);
            }
          } finally {
            reader.releaseLock();
          }
          
          
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
    }
  });
}

/**
 * Creates a retry pipe that validates the entire stream consumption.
 * This version actually consumes a test stream to validate it works end-to-end
 * before creating the final stream to return.
 * 
 * @template T The input stream type
 * @param streamFactory Function that creates a new source stream for each attempt
 * @param operators Stream operators to apply to each attempt
 * @returns A promise that resolves to a stream that should work
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
      
      // Create a test stream and fully consume it to validate
      const testStream = streamFactory();
      let pipedTestStream: ReadableStream<any> = testStream;
      
      // Apply operators to test stream
      for (const operator of operators) {
        if (typeof operator === 'function') {
          pipedTestStream = operator(pipedTestStream, { highWaterMark });
        } else if (operator && typeof operator.readable !== 'undefined' && typeof operator.writable !== 'undefined') {
          pipedTestStream = pipedTestStream.pipeThrough(operator);
        }
      }
      
      // Consume the entire test stream to validate it works
      const reader = pipedTestStream.getReader();
      try {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      } finally {
        reader.releaseLock();
      }
      
      // Test succeeded, create the actual stream to return
      const actualStream = streamFactory();
      let finalStream: ReadableStream<any> = actualStream;
      
      // Apply operators to actual stream
      for (const operator of operators) {
        if (typeof operator === 'function') {
          finalStream = operator(finalStream, { highWaterMark });
        } else if (operator && typeof operator.readable !== 'undefined' && typeof operator.writable !== 'undefined') {
          finalStream = finalStream.pipeThrough(operator);
        }
      }
      
      return finalStream;
      
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
