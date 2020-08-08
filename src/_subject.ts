export interface ISubject<T> {
  readonly readable: ReadableStream<T>
  //readonly writable: WritableStream<T>
  next(value: T): number;
  complete(): void;
  error(err: any): void;
}