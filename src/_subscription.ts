export interface Subscriber<T> {
  next(value): number;
  complete(): void;
  error(err: any): void;
}

export interface Subscription {
  dispose(): void;
}
