import { isReadableLike, ReadableLike } from "./_readable-like.js";
import { through } from "./operators/through.js";
import { Op } from "./_op.js";

type ReadableSource<T> = ReadableLike<T> | ReadableStream<T>

/**
 * Pipes a source stream through a series of operators.
 * Each operator transforms the stream in some way, creating a pipeline of transformations.
 * 
 * @template T The type of the source stream
 * @param src The source stream or ReadableLike object
 * @returns The source stream
 */
export function pipe<T>(src: ReadableSource<T> ): ReadableStream<T>;

/**
 * Pipes a source stream through one operator.
 * 
 * @template T The type of the source stream
 * @template A The type of the result stream
 * @param src The source stream or ReadableLike object
 * @param op1 The first operator
 * @returns The transformed stream
 */
export function pipe<T, A>(src: ReadableSource<T>, op1: Op<T, A>): ReadableStream<A>;

/**
 * Pipes a source stream through two operators.
 * 
 * @template T The type of the source stream
 * @template A The type after the first operator
 * @template B The type of the result stream
 * @param src The source stream or ReadableLike object
 * @param op1 The first operator
 * @param op2 The second operator
 * @returns The transformed stream
 */
export function pipe<T, A, B>(src: ReadableSource<T>, op1: Op<T, A>, op2: Op<A, B>): ReadableStream<B>;

/**
 * Pipes a source stream through three operators.
 */
export function pipe<T, A, B, C>(src: ReadableSource<T>, op1: Op<T, A>, op2: Op<A, B>, op3: Op<B, C>): ReadableStream<C>;

/**
 * Pipes a source stream through four operators.
 */
export function pipe<T, A, B, C, D>(src: ReadableSource<T>, op1: Op<T, A>, op2: Op<A, B>, op3: Op<B, C>, op4: Op<C, D>): ReadableStream<D>;

/**
 * Pipes a source stream through five operators.
 */
export function pipe<T, A, B, C, D, E>(src: ReadableSource<T>, op1: Op<T, A>, op2: Op<A, B>, op3: Op<B, C>, op4: Op<C, D>, op5: Op<D, E>): ReadableStream<E>;

/**
 * Pipes a source stream through six operators.
 */
export function pipe<T, A, B, C, D, E, F>(src: ReadableSource<T>, op1: Op<T, A>, op2: Op<A, B>, op3: Op<B, C>, op4: Op<C, D>, op5: Op<D, E>, op6: Op<E, F>): ReadableStream<F>;

export function pipe(src: ReadableSource<any>, ...ops: Op<any, any>[]): ReadableStream<any> {
  if(isReadableLike(src)){
    src = src.readable;
  }  

  return ops
    .map(x => isTransform(x) ? through(x): x)
    .reduce((p, c) => {
      return c(p, { highWaterMark: 1 })
    }, src as ReadableStream<unknown>)
}

/**
 * Type guard to check if an operator is a TransformStream.
 * 
 * @template T Input type
 * @template R Output type
 * @param x The operator to check
 * @returns True if the operator is a TransformStream
 */
function isTransform<T, R>(x: Op<T, R> ): x is TransformStream<T, R>{
  return x && typeof x === 'object' && 'readable' in x && 'writable' in x;
}