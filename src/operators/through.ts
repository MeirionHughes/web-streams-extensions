
/**
 * given a stream of T, pipeThrough a TransformStream<T,R> and return a ReadableStream of R;
 */
export function through<T, R = T>(dst: TransformStream<T, R>): (src: ReadableStream<T>) => ReadableStream<R> {
    return function (src: ReadableStream<T>) {
        return src.pipeThrough(dst);
    }
}