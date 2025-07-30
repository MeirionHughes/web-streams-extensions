import { Subscriber, SubscriptionLike } from "./_subscription.js";

/**
 * Internal class that manages multiple subscribers and handles value distribution.
 * Supports backpressure by returning the minimum desired size from all subscribers.
 * 
 * @template T The type of values handled by this subscribable
 */
export class Subscribable<T>{
  closed: boolean = false;
  subscribers: Subscriber<T>[] = [];

  /**
   * Subscribe to this subscribable with the provided subscriber callbacks.
   * 
   * @param cb - Subscriber with next, complete, and error callbacks
   * @returns A subscription that can be used to unsubscribe
   */
  subscribe(cb: Subscriber<T>): SubscriptionLike {
    let self = this;

    if (self.closed) {
      // If already closed, immediately call complete
      cb.complete();
      return {
        get closed() { return true },
        unsubscribe() { /* no-op */ }
      };
    }

    self.subscribers.push(cb);

    let _closed = false;
    return {
      get closed() { return _closed || self.closed },
      unsubscribe() {
        let index = self.subscribers.findIndex(x => x === cb);
        if (index >= 0) {
          self.subscribers.splice(index, 1);
        }
        _closed = true;
      }
    }
  }

  /**
   * Send a value to all subscribers and return the minimum desired size.
   * This enables backpressure handling by allowing the source to know when to slow down.
   * 
   * @param value - The value to send to all subscribers
   * @returns The minimum desired size from all subscribers (0 or higher means continue, negative means pause)
   */
  next(value: T): number {
    if (this.closed || this.subscribers.length === 0) {
      return 0;
    }

    const desiredSizes = this.subscribers.map(subscriber => {
      try {
        return subscriber.next(value);
      } catch (err) {
        // If a subscriber throws, handle the error gracefully
        try {
          subscriber.error(err);
        } catch (e) {
          // If error handling also fails, remove the subscriber
        }
        return 0;
      }
    });

    // Return the minimum desired size to implement proper backpressure
    return Math.min(...desiredSizes);
  }

  /**
   * Complete all subscribers and close this subscribable.
   */
  complete() {
    if (this.closed) return;

    for(let sub of this.subscribers){
      try {
        sub.complete();
      } catch (err) {
        // Ignore errors during completion
      }
    }
    this.subscribers = [];
    this.closed = true;
  }

  /**
   * Send an error to all subscribers and close this subscribable.
   * 
   * @param err - The error to send to all subscribers
   */
  error(err: any) {
    if (this.closed) return;

    for(let sub of this.subscribers){
      try {
        sub.error(err);
      } catch (e) {
        // Ignore errors during error handling
      }
    }
    this.subscribers = [];
    this.closed = true;
  }
}