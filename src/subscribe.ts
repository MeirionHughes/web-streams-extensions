import { isReadableLike, ReadableLike } from "./_readable-like.js";
import { SubscriptionLike } from "./_subscription.js";

/**  */
export function subscribe<T>(
  src: ReadableStream<T> | ReadableLike,
  next: (value: T) => Promise<void> | void,
  complete?: () => void,
  error?: (err) => void): SubscriptionLike {

  if (isReadableLike(src)) {
    src = src.readable;
  }

  let reader = src.getReader();

  let sub = {
    closed: false,
    unsubscribe() {    
      if(reader){  
        reader.cancel();
        reader = null;
      }
      this.closed = true;
    }
  }

  reader.closed.then(
    _ => {
      if (complete) complete();
    }).catch(err => {
      if (error) error(err);
    })

  async function start() {
    try {
      while (reader) {
        let chunk = await reader.read();
        if (!chunk.done) {
          try {
            await next(chunk.value)
          } catch (err) {
            sub.unsubscribe();
          }
        } else {
          reader = null;
        }
      }
    } catch (err) { }
  }

  start();

  return sub;
}

