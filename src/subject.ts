import { ISubject } from "./_subject";
import { Subscribable } from "./_subscribable";
import { SubscriptionLike } from "./_subscription";


class WritableStreamEx<W = any> extends WritableStream<W>{
  constructor(private _closed: Promise<unknown>, underlyingSink?: UnderlyingSink<W>, strategy?: QueuingStrategy<W>) {
    super(underlyingSink, strategy);
  }

  getWriter(): WritableStreamDefaultWriter<W> {
    const writer = new WritableStreamDefaultWriter(this);
    this._closed.then(async x => {
      await writer.close();
      await writer.releaseLock();
    })
    return writer;
  }
}


export class Subject<T> implements ISubject<T>{
  protected _subscribable = new Subscribable<T>();
  private _closingResolve: (value: unknown) => void;
  private _closing = new Promise((r) => this._closingResolve = r)

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
        subscription = self._subscribable.subscribe({
          next: (value: T) => {
            if (cancelled) return;;
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
    return new WritableStreamEx(
      this._closing,
      {
        write(chunk, controller) {
          self._next(chunk);
        },
        close() {
          self._complete();
        },
        abort(reason) {
          self._error(reason);
        }
      }, queuingStrategy);
  }

  private _next(value: T): number {
    return this._subscribable.next(value);
  }

  private _complete() {
    this._subscribable.complete();
  }

  private _error(err: any) {
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