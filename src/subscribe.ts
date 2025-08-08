import { isReadableLike, ReadableLike } from "./_readable-like.js";
import { SubscriptionLike } from "./_subscription.js";

/**
 * Subscribe to a ReadableStream with callbacks for next, complete, and error events.
 * Immediately begins reading from the source stream and calls the appropriate callbacks.
 * 
 * @template T The type of values in the stream
 * @param src The ReadableStream or ReadableLike to subscribe to
 * @param next Callback called for each value in the stream
 * @param complete Optional callback called when the stream completes
 * @param error Optional callback called when the stream encounters an error
 * @returns A subscription that can be used to unsubscribe and stop reading
 * 
 * @example
 * ```typescript
 * let src = from(function*() { yield 1; yield 2; yield 3; });
 * 
 * subscribe(src, 
 *   (next) => { console.log("Next:", next); },
 *   () => { console.log("Complete"); },
 *   (err) => { console.log("Error:", err); }
 * );
 * ```
 */
export function subscribe<T>(
  src: ReadableStream<T> | ReadableLike<T>,
  next: (value: T) => Promise<void> | void,
  complete?: () => void,
  error?: (err: any) => void): SubscriptionLike {

  if (isReadableLike(src)) {
    src = src.readable;
  }

  let reader = src.getReader();
  let isClosed = false;
  let isErroring = false; // Track if we're in an error state

  let sub = {
    get closed() { return isClosed; },
    unsubscribe() {   
      if (!isClosed && reader) {  
        try {
          reader.cancel();
          reader.releaseLock();
          // Only call complete if this is a normal unsubscribe, not due to error
          if(complete && !isErroring) complete();
        } catch (err) {
          console.debug("cleanup error", err);
          // Ignore cleanup errors
        } finally {
          reader = null;
        }
      }
      isClosed = true;
    }
  }

  async function start() {
    try {
      while (reader && !isClosed) {
        let chunk = await reader.read();
        if (chunk.done) {
          reader.releaseLock();
          reader = null;
          if (complete && !isClosed) {
            try {
              complete();
            } catch (err) {
              // Ignore errors in complete callback
            }
          }
          break;
        } else {
          try {
            await next(chunk.value);
          } catch (err) {
            // If next callback throws, treat it as an error
            isErroring = true;
            if (error && !isClosed) {
              try {
                error(err);
              } catch (e) {
                // Ignore errors in error callback
              }
            }
            sub.unsubscribe();
            break;
          }
        }
      }
    } catch (err) {      
      if (error && !isClosed) {
        try {
          error(err);
        } catch (e) {
          // Ignore errors in error callback
        }
      }
      isErroring = true;
      sub.unsubscribe();
    }
  }

  start();

  return sub;
}

