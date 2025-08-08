import { Subscriber, SubscriptionLike } from "../_subscription.js";
import { Subject } from "./subject.js";

export class BehaviorSubject<T> extends Subject<T>{
  private _value: T;

  constructor(init:T){
    super();
    this._value = init;    
  }

  get value(): T{
    return this._value;
  }

  protected _next(value: T){
    this._value = value;
    return super._next(value);    
  }

  subscribe(cb: Subscriber<T>): SubscriptionLike {
    let subscription = super.subscribe(cb);
    cb.next(this._value);
    return subscription;
  }
}
