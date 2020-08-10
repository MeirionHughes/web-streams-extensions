
/**  */
export function subscribe<T>(
  src: ReadableStream<T>,
  next: (value: T) => Promise<void> | void,
  complete?: () => void,
  error?: (err) => void): () => void {

  let reader = src.getReader();
  let disposer = function () {
    reader.cancel();
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
            disposer()
          }
        } else {
          reader = null;
        }
      }
    } catch (err) { }
  }

  start();

  return disposer;
}

