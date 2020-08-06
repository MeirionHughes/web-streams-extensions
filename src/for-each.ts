export async function forEach<T>(src: ReadableStream<T>, cb: (chunk: T) => void): Promise<void> {
  let reader = src.getReader();
  try {
    let done = false;

    while (done == false) {
      let next = await reader.read();
      done = next.done;
      if (!done) cb(next.value);
    }
  } catch(err) {
    reader.releaseLock();
    throw err;    
  }
}