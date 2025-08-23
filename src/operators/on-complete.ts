import { on } from './on.js';

const noop = function(){void 0};

/**
 * Creates an operator that attaches a completion callback to a stream.
 * This is a convenience wrapper around the `on` operator for handling stream completion.
 * 
 * @template T The type of values in the stream
 * @param cb Callback function to execute when the stream lifecycle event occurs
 * @returns A transform function that can be used with pipe()
 * 
 * @example
 * ```typescript
 * // Basic usage - only handles normal completion
 * from([1, 2, 3])
 *   .pipe(
 *     onComplete(() => console.log('Stream completed'))
 *   )
 * ```
 */
export function onComplete<T>(cb: () => void): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T>

/**
 * Creates an operator that attaches a unified lifecycle callback to a stream.
 * When `joinErrorCancel` is true, this callback will handle completion, errors, and cancellation.
 * 
 * @template T The type of values in the stream
 * @param cb Callback function that receives the error/cancel reason, or no parameters for normal completion
 * @param joinErrorCancel When true, bundles complete, error, and cancel callbacks into one
 * @returns A transform function that can be used with pipe()
 * 
 * @example
 * ```typescript
 * // Bundled usage - handles completion, errors, and cancellation
 * from([1, 2, 3])
 *   .pipe(
 *     onComplete((reasonOrError?: any) => {
 *       if (reasonOrError) {
 *         console.log('Stream error/cancel:', reasonOrError);
 *       } else {
 *         console.log('Stream completed normally');
 *       }
 *     }, true)
 *   )
 * ```
 */
export function onComplete<T>(cb: (reasonOrError?:any) => void, joinErrorCancel: boolean): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T>

/**
 * Implementation of the onComplete operator.
 * 
 * The onComplete operator provides two modes of operation:
 * 
 * 1. **Simple mode** (default): Only handles normal stream completion
 *    - Callback is called with no parameters when the stream completes naturally
 *    - Errors and cancellations are ignored
 * 
 * 2. **Bundled mode** (`joinErrorCancel: true`): Handles all lifecycle events
 *    - Normal completion: Callback is called with no parameters
 *    - Stream error: Callback is called with the error as parameter
 *    - Stream cancellation: Callback is called with the cancellation reason as parameter
 * 
 * This operator is useful for:
 * - Logging stream lifecycle events
 * - Cleanup operations after stream completion
 * - Analytics and monitoring
 * - Resource management
 * 
 * @template T The type of values in the stream
 * @param cb The callback function to execute
 * @param joinErrorCancel Whether to bundle all lifecycle events into one callback
 * @returns A transform function that can be used with pipe()
 */
export function onComplete<T>(cb: (reasonOrError?:any) => void, joinErrorCancel: boolean = false): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T> {
  if (joinErrorCancel) {
    // Bundle complete, error, and cancel into the single callback
    return on({
      start: noop, 
      complete: () => cb(),
      error: (err) => cb(err),
      cancel: (reason) => cb(reason)
    });
  } else {
    // Just handle complete callback (backwards compatibility)
    return on({start: noop, complete: cb as () => void, error: noop});
  }
}
