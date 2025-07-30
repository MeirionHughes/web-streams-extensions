
/**
 * Interface for objects that have a readable property containing a ReadableStream.
 * This allows objects like TransformStream to be used in places that expect ReadableStreams.
 * 
 * @template T The type of values emitted by the readable stream
 */
export interface ReadableLike<T = any> {
    readonly readable: ReadableStream<T>;
}

/**
 * Type guard to check if an object implements the ReadableLike interface.
 * 
 * @template T The type of values emitted by the readable stream
 * @param obj The object to check
 * @returns True if the object has a readable property
 */
export function isReadableLike<T>(obj: any): obj is ReadableLike<T> {
    return obj && typeof obj === 'object' && 'readable' in obj && obj.readable instanceof ReadableStream;
}
