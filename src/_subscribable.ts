import { Subscriber, SubscriptionLike } from "./_subscription.js";

export class Subscribable<T>{
  closed: boolean = false;
  subscribers: Subscriber<T>[] = [];

  subscribe(cb: Subscriber<T>): SubscriptionLike {
    let self = this;

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
  next(value: T): number {
    return Math.min(...this.subscribers.map(x => x.next(value)));
  }
  complete() {
    for(let sub of this.subscribers){
      sub.complete()
    }
    this.subscribers = [];
    this.closed = true;
  }
  error(err) {
    for(let sub of this.subscribers){
      sub.error(err);
    }
    this.subscribers = [];
    this.closed = true;
  }
}