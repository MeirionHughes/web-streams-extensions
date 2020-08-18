export interface UnaryFunction<T, R> {
  (source: T, opt?: { highWaterMark: number }): R;
}

export interface Op<T, R> extends UnaryFunction<ReadableStream<T>, ReadableStream<R>> {

}