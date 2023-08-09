export interface ISubject<T> extends TransformStream<T, T> {
  readonly closed: boolean;
}