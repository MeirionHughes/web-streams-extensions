import { through } from ".";
import { Op } from "./_op";

export function pipe<T>(src: ReadableStream<T>): ReadableStream<T>;
export function pipe<T, A>(src: ReadableStream<T>, op1: Op<T, A>): ReadableStream<A>;
export function pipe<T, A, B>(src: ReadableStream<T>, op1: Op<T, A>, op2: Op<A, B>): ReadableStream<B>;
export function pipe<T, A, B, C>(src: ReadableStream<T>, op1: Op<T, A>, op2: Op<A, B>, op3: Op<B, C>): ReadableStream<C>;
export function pipe<T, A, B, C, D>(src: ReadableStream<T>, op1: Op<T, A>, op2: Op<A, B>, op3: Op<B, C>, op4: Op<C, D>): ReadableStream<D>;
export function pipe<T, A, B, C, D, E>(src: ReadableStream<T>, op1: Op<T, A>, op2: Op<A, B>, op3: Op<B, C>, op4: Op<C, D>, op5: Op<D, E>): ReadableStream<E>;
export function pipe<T, A, B, C, D, E, F>(src: ReadableStream<T>, op1: Op<T, A>, op2: Op<A, B>, op3: Op<B, C>, op4: Op<C, D>, op5: Op<D, E>, op6: Op<E, F>): ReadableStream<F>;
export function pipe(src: ReadableStream<any>, ...ops: Op<any, any>[]): ReadableStream<any> {
  return ops
    .map(x => isTransform(x) ? through(x): x)
    .reduce((p, c) => {
      return c(p, { highWaterMark: 1 })
    }, src)

}

function isTransform<T, R>(x: Op<T, R> ): x is TransformStream<T, R>{
  return x['readable'] != null && x['writable'] != null;
}