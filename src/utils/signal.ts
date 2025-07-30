/**
 * A simple signal class for coordinating asynchronous operations.
 * Allows multiple parties to wait for a signal and be notified when it occurs.
 * 
 * @example
 * ```typescript
 * let signal = new Signal();
 * 
 * // Start waiting for the signal
 * signal.wait().then(() => console.log('Signal received!'));
 * 
 * // Later, trigger the signal
 * signal.signal();
 * ```
 */
export class Signal {
  private _sub: (() => void)[] = [];

  /**
   * Wait for the signal to be triggered.
   * @returns A promise that resolves when signal() is called
   */
  async wait(): Promise<void> {
    return new Promise<void>(resolve => {
      const callback = () => {
        const index = this._sub.indexOf(callback);
        if (index !== -1) {
          this._sub.splice(index, 1);
        }
        resolve();
      };
      this._sub.push(callback);
    });
  }

  /**
   * Trigger the signal, notifying all waiting parties.
   */
  signal(): void {
    const subscribers = [...this._sub]; // Copy to avoid mutation during iteration
    this._sub.length = 0; // Clear the array
    for (const sub of subscribers) {
      try {
        sub();
      } catch (err) {
        // Don't let one subscriber error affect others
        console.error('Error in signal subscriber:', err);
      }
    }
  }
}

/**
 * A concurrent gate that limits the number of operations that can proceed simultaneously.
 * Useful for implementing semaphore-like behavior.
 * 
 * @example
 * ```typescript
 * let gate = new Gate(2); // Allow 2 concurrent operations
 * 
 * async function limitedOperation() {
 *   await gate.wait(); // Wait for a slot
 *   try {
 *     // Do work here
 *   } finally {
 *     gate.increment(); // Release the slot
 *   }
 * }
 * ```
 */
export class Gate {
  private _queue: (() => void)[] = [];

  /**
   * Create a new Gate with the specified initial count.
   * @param _count The initial number of operations that can proceed immediately
   */
  constructor(private _count: number) {
  }

  /**
   * Wait for permission to proceed. If count > 0, returns immediately.
   * Otherwise, waits until increment() is called.
   * @returns A promise that resolves when permission is granted
   */
  async wait(): Promise<void> {
    if (this._count > 0) {
      --this._count;
      return Promise.resolve();
    }

    return new Promise<void>(resolve => {
      const callback = () => {
        const index = this._queue.indexOf(callback);
        if (index !== -1) {
          this._queue.splice(index, 1);
        }
        --this._count;
        resolve();
      };
      this._queue.push(callback);
    });
  }

  /**
   * Increment the count, potentially allowing queued operations to proceed.
   */
  increment(): void {
    ++this._count;
    this.clearQueue();
  }

  /**
   * Set the count to a specific value and clear any waiting operations.
   * @param count The new count value
   */
  setCount(count: number): void {
    this._count = count;
    this.clearQueue();
  }

  /**
   * Get the current count.
   * @returns The current count
   */
  get count(): number {
    return this._count;
  }

  /**
   * Get the number of operations waiting in the queue.
   * @returns The queue length
   */
  get queueLength(): number {
    return this._queue.length;
  }

  private clearQueue(): void {
    while (this._count > 0 && this._queue.length > 0) {
      const callback = this._queue.shift();
      if (callback) {
        try {
          callback();
        } catch (err) {
          console.error('Error in gate callback:', err);
        }
      }
    }
  }
}

/**
 * A blocking queue that coordinates between pushers and pullers.
 * When a value is pushed, it's immediately delivered to a waiting puller if available.
 * Otherwise, the pusher waits until a puller becomes available.
 * 
 * @template T The type of values stored in the queue
 * 
 * @example
 * ```typescript
 * let queue = new BlockingQueue<number>();
 * 
 * // Producer
 * queue.push(42); // Waits until a consumer is ready
 * 
 * // Consumer
 * let value = await queue.pull(); // Gets 42
 * ```
 */
export class BlockingQueue<T> {
  private _pushers: (() => T)[] = [];
  private _pullers: ((value: T) => void)[] = [];

  constructor() { }

  /**
   * Push a value to the queue. If no puller is waiting, this will block
   * until a puller calls pull().
   * @param value The value to push
   * @returns A promise that resolves when the value has been delivered
   */
  async push(value: T): Promise<void> {
    return new Promise<void>(resolve => {
      this._pushers.unshift(() => { 
        resolve(); 
        return value; 
      });
      this.dequeue();
    });
  }

  /**
   * Pull a value from the queue. If no pusher is waiting, this will block
   * until a pusher calls push().
   * @returns A promise that resolves with the pulled value
   */
  async pull(): Promise<T> {
    return new Promise<T>(resolve => {
      this._pullers.unshift((value: T) => { 
        resolve(value); 
      });
      this.dequeue();
    });
  }

  /**
   * Get the number of pushers waiting to deliver values.
   * @returns The number of waiting pushers
   */
  get pushersWaiting(): number {
    return this._pushers.length;
  }

  /**
   * Get the number of pullers waiting for values.
   * @returns The number of waiting pullers
   */
  get pullersWaiting(): number {
    return this._pullers.length;
  }

  private dequeue(): void {
    while (this._pullers.length > 0 && this._pushers.length > 0) {
      const puller = this._pullers.pop();
      const pusher = this._pushers.pop();
      if (puller && pusher) {
        try {
          const value = pusher();
          puller(value);
        } catch (err) {
          console.error('Error in blocking queue dequeue:', err);
        }
      }
    }
  }
}