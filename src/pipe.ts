import { isReadableLike, ReadableLike } from "./_readable-like.js";
import { through } from "./operators/through.js";
import { isTransform } from "./utils/is-transform.js";
import { Op } from "./_op.js";

export type ReadableSource<T> = ReadableLike<T> | ReadableStream<T>

export type PipeOptions = QueuingStrategy

/**
 * Pipes a source stream through a series of operators.
 * Each operator transforms the stream in some way, creating a pipeline of transformations.
 * 
 * @template T The type of the source stream
 * @param src The source stream or ReadableLike object
 * @returns The source stream
 * 
 * @example
 * ```typescript
 * const result = pipe(
 *   from([1, 2, 3, 4, 5]),
 *   map(x => x * 2),
 *   filter(x => x > 5)
 * );
 * ```
 */
export function pipe<T>(
  src: ReadableSource<T>
): ReadableStream<T>;

export function pipe<T, R1>(
  src: ReadableSource<T>,
  op1: Op<T, R1> | PipeOptions
): ReadableStream<R1>;

export function pipe<T, R1, R2=R1>(
  src: ReadableSource<T>,
  op1: Op<T, R1>,
  op2: Op<R1, R2> | PipeOptions
): ReadableStream<R2>;

export function pipe<T, R1, R2, R3=R2>(
  src: ReadableSource<T>,
  op1: Op<T, R1>,
  op2: Op<R1, R2>,
  op3: Op<R2, R3> | PipeOptions
): ReadableStream<R3>;

export function pipe<T, R1, R2, R3, R4=R3>(
  src: ReadableSource<T>,
  op1: Op<T, R1>,
  op2: Op<R1, R2>,
  op3: Op<R2, R3>,
  op4: Op<R3, R4> | PipeOptions
): ReadableStream<R4>;

export function pipe<T, R1, R2, R3, R4, R5=R4>(
  src: ReadableSource<T>,
  op1: Op<T, R1>,
  op2: Op<R1, R2>,
  op3: Op<R2, R3>,
  op4: Op<R3, R4>,
  op5: Op<R4, R5> | PipeOptions
): ReadableStream<R5>;

export function pipe<T, R1, R2, R3, R4, R5, R6=R5>(
  src: ReadableSource<T>,
  op1: Op<T, R1>,
  op2: Op<R1, R2>,
  op3: Op<R2, R3>,
  op4: Op<R3, R4>,
  op5: Op<R4, R5>,
  op6: Op<R5, R6> | PipeOptions
): ReadableStream<R6>;

export function pipe<T, R1, R2, R3, R4, R5, R6, R7=R6>(
  src: ReadableSource<T>,
  op1: Op<T, R1>,
  op2: Op<R1, R2>,
  op3: Op<R2, R3>,
  op4: Op<R3, R4>,
  op5: Op<R4, R5>,
  op6: Op<R5, R6>,
  op7: Op<R6, R7> | PipeOptions
): ReadableStream<R7>;

export function pipe<T, R1, R2, R3, R4, R5, R6, R7, R8=R7>(
  src: ReadableSource<T>,
  op1: Op<T, R1>,
  op2: Op<R1, R2>,
  op3: Op<R2, R3>,
  op4: Op<R3, R4>,
  op5: Op<R4, R5>,
  op6: Op<R5, R6>,
  op7: Op<R6, R7>,
  op8: Op<R7, R8> | PipeOptions
): ReadableStream<R8>;

export function pipe<T, R1, R2, R3, R4, R5, R6, R7, R8, R9=R8>(
  src: ReadableSource<T>,
  op1: Op<T, R1>,
  op2: Op<R1, R2>,
  op3: Op<R2, R3>,
  op4: Op<R3, R4>,
  op5: Op<R4, R5>,
  op6: Op<R5, R6>,
  op7: Op<R6, R7>,
  op8: Op<R7, R8>,
  op9: Op<R8, R9> | PipeOptions
): ReadableStream<R9>;

export function pipe<T, R1, R2, R3, R4, R5, R6, R7, R8, R9, R10=R9>(
  src: ReadableSource<T>,
  op1: Op<T, R1>,
  op2: Op<R1, R2>,
  op3: Op<R2, R3>,
  op4: Op<R3, R4>,
  op5: Op<R4, R5>,
  op6: Op<R5, R6>,
  op7: Op<R6, R7>,
  op8: Op<R7, R8>,
  op9: Op<R8, R9>,
  op10: Op<R9, R10> | PipeOptions
): ReadableStream<R10>;

export function pipe(src: ReadableSource<any>, ...args: any[]): ReadableStream<any> {
  if(isReadableLike(src)){
    src = src.readable;
  }

  // Extract options from the end of arguments if present
  let options: PipeOptions = { highWaterMark: 16 }; // default highWaterMark
  let operators: any[] = args;

  // Check if last argument is options (QueuingStrategy)
  const lastArg = args[args.length - 1];
  if (lastArg && typeof lastArg === 'object' && 
      !lastArg.readable && !lastArg.writable && 
      typeof lastArg.pipeThrough !== 'function' &&
      (lastArg.highWaterMark !== undefined || lastArg.size !== undefined)) {
    options = { ...options, ...lastArg };
    operators = args.slice(0, -1);
  }

  return operators
    .map(x => isTransform(x) ? through(x): x)
    .reduce((stream, operator) => {
      return operator(stream, options)
    }, src as ReadableStream<any>)
}