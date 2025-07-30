
/**
 * Represents a unary function that transforms a source with optional configuration.
 * 
 * @template T The input type
 * @template R The output type
 */
export interface UnaryFunction<T, R> {
  (source: T, opt?: { highWaterMark?: number }): R;
}

/**
 * Represents a stream operator that can transform ReadableStreams.
 * Can be either a function that transforms streams or a TransformStream.
 * 
 * @template T The input stream type
 * @template R The output stream type
 */
export type Op<T, R> = UnaryFunction<ReadableStream<T>, ReadableStream<R>> | TransformStream<T, R>;