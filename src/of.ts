import { from } from "./from";

export function of<T = unknown>(...args:T[]): ReadableStream<T>{
  return from(args);
}