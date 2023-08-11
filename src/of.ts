import { from } from "./from.js";

export function of<T = unknown>(...args:T[]): ReadableStream<T>{
  return from(args);
}