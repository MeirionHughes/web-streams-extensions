export interface ISubject<T> {
  readonly closed: boolean;
  readonly readable: ReadableStream<T>;
  readonly writable: WritableStream<T>;
}