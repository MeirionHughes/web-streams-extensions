import { Subscriber, SubscriptionLike } from "../_subscription.js";
import { Subject } from "./subject.js";

interface ReplayEvent<T> {
  time: number;
  value: T;
}

/**
 * A variant of Subject that "replays" old values to new subscribers by emitting them when they first subscribe.
 * 
 * Like Subject, ReplaySubject "observes" values by having them passed to its next method.
 * When it observes a value, it will store that value for a time determined by the configuration
 * of the ReplaySubject, as passed to its constructor.
 * 
 * When a new subscriber subscribes to the ReplaySubject instance, it will synchronously emit all
 * values in its buffer in a First-In-First-Out (FIFO) manner. The ReplaySubject will also complete,
 * if it has observed completion; and it will error if it has observed an error.
 * 
 * @template T The type of values emitted by the subject
 */
export class ReplaySubject<T> extends Subject<T> {
  private _buffer: ReplayEvent<T>[] = [];
  private _bufferSize: number;
  private _windowTime: number;
  private _timestampProvider: () => number;
  private _replayHasError = false;
  private _replayError: any = null;
  private _replayHasCompleted = false;

  /**
   * Creates a new ReplaySubject instance.
   * 
   * @param bufferSize - The size of the buffer to replay on subscription (default: Infinity)
   * @param windowTime - The amount of time the buffered items will stay buffered (default: Infinity)
   * @param timestampProvider - An object with a now() method that provides the current timestamp (default: Date.now)
   */
  constructor(
    bufferSize: number = Infinity,
    windowTime: number = Infinity,
    timestampProvider: () => number = () => Date.now()
  ) {
    super();
    this._bufferSize = bufferSize;
    this._windowTime = windowTime;
    this._timestampProvider = timestampProvider;
  }

  /**
   * Subscribe to this replay subject. New subscribers will immediately receive all buffered values.
   * 
   * @param cb - Subscriber callbacks
   * @returns A subscription that can be used to unsubscribe
   */
  subscribe(cb: Subscriber<T>): SubscriptionLike {
    this._trimBuffer();
    
    // Emit all buffered values to the new subscriber synchronously
    for (const event of this._buffer) {
      cb.next(event.value);
    }
    
    // Now subscribe to future values
    const subscription = super.subscribe(cb);
    
    // If subject has completed or errored, handle it immediately
    if (this._replayHasCompleted) {
      cb.complete?.();
    } else if (this._replayHasError) {
      cb.error?.(this._replayError);
    }
    
    return subscription;
  }

  protected _next(value: T): number {
    if (this._replayHasError || this._replayHasCompleted) {
      return 0;
    }
    
    const now = this._timestampProvider();
    this._buffer.push({ time: now, value });
    this._trimBuffer();
    return super._next(value);
  }

  protected _complete() {
    this._replayHasCompleted = true;
    return super._complete();
  }

  protected _error(err: any) {
    this._replayHasError = true;
    this._replayError = err;
    return super._error(err);
  }

  /**
   * Removes old values from the buffer based on bufferSize and windowTime constraints.
   */
  private _trimBuffer(): void {
    if (this._buffer.length === 0) {
      return;
    }
    
    const now = this._timestampProvider();
    
    // Remove items outside the time window (only if window time is finite)
    if (this._windowTime < Infinity) {
      const cutoffTime = now - this._windowTime;
      while (this._buffer.length > 0 && this._buffer[0].time < cutoffTime) {
        this._buffer.shift();
      }
    }
    
    // Remove items exceeding buffer size
    while (this._buffer.length > this._bufferSize) {
      this._buffer.shift();
    }
  }

  /**
   * Gets the current number of buffered values.
   * @returns The number of values currently in the buffer
   */
  get bufferSize(): number {
    return this._buffer.length;
  }

  /**
   * Gets the configured maximum buffer size.
   * @returns The maximum number of values that can be buffered
   */
  get maxBufferSize(): number {
    return this._bufferSize;
  }

  /**
   * Gets the configured window time in milliseconds.
   * @returns The time window for buffered values
   */
  get windowTime(): number {
    return this._windowTime;
  }
}
