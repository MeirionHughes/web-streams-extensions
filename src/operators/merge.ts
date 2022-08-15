import { from } from "../from";
import { isReadableStream } from "../utils/is-readable";

type Entry<T> = {
  src: ReadableStream<T>
  reader?: ReadableStreamDefaultReader<T>;
  next?: Promise<ReadableStreamDefaultReadResult<T>>;
}

async function* concurrentResolver(promisesIter, numInParallel) {
  const pending = [];

  for (let i = 0; i < numInParallel; i++) {
    const next = promisesIter.next();
    if (next.done) {
      break;
    }
    pending.push(next.value);
  }

  while (pending.length) {
    const darkMagic = pending.map((p) => p.then((_) => [p]));
    const [promise] = await Promise.race(darkMagic);
    pending.splice(pending.indexOf(promise), 1);

    const next = promisesIter.next();
    if (!next.done) {
      pending.push(next.value);
    }

    // the following `await` is instantaneous, since
    // the promise has already been resolved.
    yield await promise;
  }
}

export function merge<T>(concurrent: number = Infinity): (src: ReadableStream<ReadableStream<T> | Promise<T>>) => ReadableStream<T> {

  return function (src: ReadableStream<ReadableStream<T>>) {
    let readerSrc: ReadableStreamDefaultReader<ReadableStream<T> | Promise<T>> = null;
    let queue: Entry<T>[] = [];

    async function flush(controller: ReadableStreamDefaultController<T>) {
      try {
        if (readerSrc == null && queue.length == 0)
          return;

        while (controller.desiredSize > 0) {
          // fill out entry sources to max concurrency
          // probably need to move this into its own promise
          // so it doesn't block main consuming loop;
          
          while (queue.length < concurrent && readerSrc != null) {
           
            const next = await readerSrc.read();

            if (next.done) {
              readerSrc = null;
              break;
            }

            let value = next.value;

            if (!(value instanceof ReadableStream)) {
              value = from(value);
            }

            let entry = {
              src: value,
              reader: value.getReader(),
              next: null
            }
            queue.push(entry);
          }

          for (let entry of queue) {
            if (entry.reader && entry.next == null) {
              entry.next = entry.reader.read();
            }
          }

          if (readerSrc == null && queue.length == 0) {
            controller.close();
            return;
          }

          //get the next to complete;
          let complete = await Promise.race(queue.map(entry => entry.next.then((result) => ({ entry, result }))));

          complete.entry.next = null;

          //if its done, remove the entry from the queue
          if (complete.result.done) {
            queue.splice(queue.indexOf(complete.entry), 1);
          } else {
            controller.enqueue(complete.result.value);
          }
        }
      } catch (err) {
        controller.error(err);
      }
    }

    return new ReadableStream<T>({
      async start(controller) {
        readerSrc = src.getReader();
        return flush(controller);
      },
      async pull(controller) {
        return flush(controller);
      },
      async cancel(reason?: any) {
        if (readerSrc) {
          readerSrc.cancel(reason);
          readerSrc.releaseLock();
          readerSrc = null;
        }
      }
    });
  }
}

