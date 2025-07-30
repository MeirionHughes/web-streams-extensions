/**
 * Interface for subscriber callbacks that handle stream events.
 * 
 * @template T The type of values this subscriber handles
 */
export interface Subscriber<T> {
  /**
   * Called when a new value is available.
   * 
   * @param value - The new value
   * @returns The desired size for backpressure control (positive = continue, 0 = pause, negative = slow down)
   */
  next(value: T): number;
  
  /**
   * Called when the stream completes successfully.
   */
  complete(): void;
  
  /**
   * Called when the stream encounters an error.
   * 
   * @param err - The error that occurred
   */
  error(err: any): void;
}

/**
 * Interface for subscription objects that can be used to unsubscribe from a stream.
 */
export interface SubscriptionLike {
  /**
   * Whether this subscription has been closed/unsubscribed.
   */
  readonly closed: boolean;
  
  /**
   * Unsubscribe from the stream, stopping further notifications.
   */
  unsubscribe(): void;
}
