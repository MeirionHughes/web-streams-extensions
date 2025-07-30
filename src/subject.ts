import { ISubject } from "./_subject.js";
import { Subscribable } from "./_subscribable.js";
import { Subscriber, SubscriptionLike } from "./_subscription.js";

/**
 * A Subject is a special type of stream that allows values to be multicast to many observers.
 * It acts as both an observer and an observable, implementing both readable and writable streams.
 * 
 * @template T The type of values emitted by the subject
 */
export class Subject<T> implements ISubject<T> {
  protected _subscribable = new Subscribable<T>();
  private _closingResolve: (value: unknown) => void;
  private _closing: Promise<void>;
  private _writableStream: WritableStream<T> | null = null;
  private _abortController: AbortController | null = null;

  constructor() {
    const self = this;
    this._closing = new Promise(function (r) { self._closingResolve = r });
  }

  get closed() {
    return this._subscribable.closed;
  }

  /**
   * Creates a new readable stream that will emit all values from this subject.
   * Each call to this getter returns a new ReadableStream that will receive all subsequent values.
   * 
   * @returns A new ReadableStream that emits values from this subject
   */
  get readable(): ReadableStream<T> {
    let self = this;
    let subscription: SubscriptionLike;
    let cancelled = false;
    return new ReadableStream({
      async start(controller) {
        subscription = self.subscribe({
          next: (value: T) => {
            if (cancelled) return 1; // Return positive number to indicate successful processing
            try {
              controller.enqueue(value);
              return controller.desiredSize || 0;
            } catch (err) {
              // Controller might be closed, ignore enqueue errors when cancelled
              return 0;
            }
          },
          complete: () => {
            if (!cancelled) {
              try {
                controller.close();
              } catch (err) {
                // Controller might already be closed, ignore
              }
            }
          },
          error: (err) => {
            if (!cancelled) {
              try {
                controller.error(err);
              } catch (e) {
                // Controller might already be errored, ignore
              }
            }
          }
        });
      },
      cancel() {
        cancelled = true;
        if (subscription) {
          subscription.unsubscribe();
        }
      }
    })
  };

  /**
   * Creates a writable stream that can be used to send values to this subject.
   * Values written to this stream will be emitted to all subscribers.
   * 
   * @returns A WritableStream that accepts values of type T
   */
  get writable() {
    const queuingStrategy = new CountQueuingStrategy({ highWaterMark: 1 });
    const self = this;
    let stream = new WritableStream(
      {
        write(chunk, controller) {
          if (self.closed) {
            controller.error(new Error("Subject is closed"));
            return;
          }
          if (controller.signal.aborted) {
            self._error(controller.signal.reason || new Error("Aborted"));
            controller.error("aborted");
            return;
          }
          try {
            self._next(chunk);
          } catch (err) {
            controller.error(err);
          }
        },
        close() {
          self._complete();
        },
        abort(reason) {
          self._error(reason || new Error("Stream aborted"));
        }
      }, queuingStrategy);

    this._closing.then(_ => {
      if (!stream.locked) {
        try {
          stream.close();
        } catch (err) {
          // Stream might already be closed, ignore
        }
      }
    })
    return stream;
  }

  /**
   * Subscribe to this subject with callbacks for next, complete, and error events.
   * 
   * @param cb - Subscriber callbacks
   * @returns A subscription that can be used to unsubscribe
   */
  subscribe(cb: Subscriber<T>): SubscriptionLike {
    let subscription = this._subscribable.subscribe(cb);
    return subscription;
  }

  protected _next(value: T): number {
    return this._subscribable.next(value);
  }

  protected _complete() {
    this._subscribable.complete();
  }

  protected _error(err: any) {
    this._subscribable.error(err);
  }

  /**
   * Emit a value to all subscribers.
   * 
   * @param value - The value to emit
   * @returns Promise that resolves to the minimum desired size from all subscribers
   */
  async next(value: T): Promise<number> {
    return this._next(value);
  }

  /**
   * Complete the subject. No more values will be emitted.
   * 
   * @returns Promise that resolves when completion is processed
   */
  async complete() {
    this._closingResolve(void 0);
    return this._complete();
  }

  /**
   * Error the subject. All subscribers will receive the error.
   * 
   * @param err - The error to emit
   * @returns Promise that resolves when error is processed
   */
  async error(err: any) {
    this._closingResolve(void 0);
    return this._error(err);
  }
}