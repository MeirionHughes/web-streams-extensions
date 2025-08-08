import { Op } from "../_op.js";

/**
 * Type guard to check if an operator is a TransformStream.
 * 
 * @template T Input type
 * @template R Output type
 * @param x The operator to check
 * @returns True if the operator is a TransformStream
 */
export function isTransform<T, R>(x: Op<T, R>): x is TransformStream<T, R> {
  return x && typeof x === 'object' && 'readable' in x && 'writable' in x;
}
