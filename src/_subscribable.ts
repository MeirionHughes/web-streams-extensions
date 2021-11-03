import { Subscriber, Subscription } from "./_subscription";

export class Subscribable<T>{
  closed: boolean = false;
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
    this.closed = true;
  }
  error(err) {
    this.subscribers.forEach(x => x.error(err));
    this.subscribers = [];
    this.closed = true;
  }
}