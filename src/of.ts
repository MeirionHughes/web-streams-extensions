import { from } from "./from.js";

/**
 * Creates a ReadableStream that emits the provided arguments in order.
 * 
 * @template T The type of values to emit
 * @param args The values to emit
 * @returns A ReadableStream that emits each argument in sequence
 * 
 * @example
 * ```typescript
 * of(1, "foo", () => "bar", {})
 * // Emits: 1, "foo", () => "bar", {}
 * ```
 */
export function of<T = unknown>(...args:T[]): ReadableStream<T>{
  return from(args);
}