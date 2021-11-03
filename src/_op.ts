
export interface UnaryFunction<T, R> {
  (source: T, opt?: { highWaterMark?: number }): R;
}

export type Op<T, R> = UnaryFunction<ReadableStream<T>, ReadableStream<R>> | TransformStream<T, R>;