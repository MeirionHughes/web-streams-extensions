
/**
 * Represents a unary function that transforms a source with optional configuration.
 * @param source input stream
 * @param strategy QueuingStrategy for the output stream.
 * @returns output stream 
 * @template T The input type
 * @template R The output type
 */
export interface UnaryFunction<T, R> {
  (source: ReadableStream<T>, strategy?: QueuingStrategy<R>): ReadableStream<R>;
}

/**
 * Represents a stream operator that can transform ReadableStreams.
 * Can be either a function that transforms streams or a TransformStream.
 * 
 * @template T The input stream type
 * @template R The output stream type
 */
export type Op<T, R> = UnaryFunction<T, R> | TransformStream<T, R>;