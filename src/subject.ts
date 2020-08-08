import { ISubject } from "./_subject";

export interface Subscriber<T> {
  next(value): number;
  complete(): void;
  error(err: any): void;
}

export interface Subscription {
  dispose(): void;
}

class Subscribable<T>{
  subscribers: Subscriber<T>[] = [];

  subscribe(cb: Subscriber<T>): Subscription {
    let self = this;

    self.subscribers.push(cb);

    return {
      dispose() {
        let index = self.subscribers.findIndex(x => x === cb);
        if (index >= 0) {
          self.subscribers.splice(index, 1);
        }
      }
    }
  }
  next(value: T): number {
    return Math.min(...this.subscribers.map(x => x.next(value)));
  }
  complete() {
    this.subscribers.forEach(x => x.complete());
    this.subscribers = [];
  }
  error(err) {
    this.subscribers.forEach(x => x.error(err));
  }
}

export class Subject<T> implements ISubject<T>{
  private _subscribable = new Subscribable<T>();
  private _writable: WritableStream<T>;

  /** create a new readable */
  get readable(): ReadableStream<T> {
    let self = this;
    let subscription: Subscription;
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
          subscription.dispose();
        }
      }
    })
  };

  get writable(){
    return this._writable;
  }

  constructor() {
    let self = this;
    const queuingStrategy = new CountQueuingStrategy({ highWaterMark: 1 });
    this._writable = new WritableStream({
      write(chunk, controller) {
        self.next(chunk);
      },
      close(){
        self.complete();
      },
      abort(reason){
        self.error(reason);
      }            
    }, queuingStrategy);
  }

  next(value:T):number{
    return this._subscribable.next(value);
  }

  complete(){
    this._subscribable.complete();    
  }

  error(err: any){
    this._subscribable.error(err);
  }
}