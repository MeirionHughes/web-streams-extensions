
/**
 * Creates a through operator that pipes a stream through a TransformStream.
 * This allows using standard Web Streams TransformStreams as operators in a pipe chain.
 * 
 * @template T The input type
 * @template R The output type
 * @param dst The TransformStream to pipe through
 * @returns A transform function that can be used with pipe()
 * 
 * @example
 * ```typescript
 * // Using a custom TransformStream
 * let upperCaseTransform = new TransformStream({
 *   transform(chunk, controller) {
 *     controller.enqueue(chunk.toUpperCase());
 *   }
 * });
 * 
 * from(['hello', 'world'])
 *   .pipe(
 *     through(upperCaseTransform)
 *   )
 * // Emits: "HELLO", "WORLD"
 * ```
 */
export function through<T, R = T>(dst: TransformStream<T, R>): (src: ReadableStream<T>) => ReadableStream<R> {
    return function (src: ReadableStream<T>) {
        if (!dst || typeof dst.readable === 'undefined' || typeof dst.writable === 'undefined') {
            throw new Error('Invalid TransformStream provided to through operator');
        }
        return src.pipeThrough(dst);
    };
}