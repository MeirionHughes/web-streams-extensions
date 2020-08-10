export interface ISubject<T> {
  readonly readable: ReadableStream<T>;
  readonly writable: WritableStream<T>;
}