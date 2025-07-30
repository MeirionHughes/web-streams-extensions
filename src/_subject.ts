/**
 * Interface for Subject implementations.
 * A Subject is a special type of stream that allows values to be multicast to many observers.
 * It implements TransformStream, providing both readable and writable sides.
 * 
 * @template T The type of values handled by this subject
 */
export interface ISubject<T> extends TransformStream<T, T> {
  /**
   * Whether this subject has been closed and will no longer emit values.
   */
  readonly closed: boolean;
}