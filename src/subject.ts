import { ISubject } from "./_subject.js";
import { Subscribable } from "./_subscribable.js";
import { Subscriber, SubscriptionLike } from "./_subscription.js";

export class Subject<T> implements ISubject<T> {
  protected _subscribable = new Subscribable<T>();
  private _closingResolve: (value: unknown) => void;
  private _closing: Promise<void>;

  constructor() {
    const self = this;
    this._closing = new Promise(function (r) { self._closingResolve = r });
  }

  constructor(){
    const self = this;
    this._closing = new Promise(function(r) {self._closingResolve = r});
  }

  get closed() {
    return this._subscribable.closed;
  }

  /** create a new readable */
  get readable(): ReadableStream<T> {
    let self = this;
    let subscription: SubscriptionLike;
    let cancelled = false;
    return new ReadableStream({
      async start(controller) {
        subscription = self.subscribe({
          next: (value: T) => {
            if (cancelled) return;
            controller.enqueue(value);
            return controller.desiredSize;
          },
          complete: () => {
            controller.close();
          },
          error: (err) => {
            controller.error(err);
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

  get writable() {
    const queuingStrategy = new CountQueuingStrategy({ highWaterMark: 1 });
    const self = this;
    let stream = new WritableStream(
      {
        write(chunk, controller) {
          if (self.closed && controller.signal.aborted == false) {
            controller.error();
            return;
          }
          if (controller.signal.aborted) {
            self._error(controller.signal.reason);
            return;
          }
          self._next(chunk);
        },
        close() {
          self._complete();
        },
        abort(reason) {
          self._error(reason);
        }
      }, queuingStrategy);
    this._closing.then(_ => {
      if (stream.locked == false) {
        stream.close();
      }
    })
    return stream;
  }

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

  async next(value: T): Promise<number> {
    return this._next(value);
  }

  async complete() {
    this._closingResolve(void 0);
    return this._complete();
  }

  async error(err: any) {
    this._closingResolve(void 0);
    return this._error(err);
  }
}