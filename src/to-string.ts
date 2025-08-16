/**
 * combines a stream of chunks to a string. */
export async function toString<T>(src: ReadableStream<T>, selector: (value:T)=>string = (value)=>value.toString()): Promise<string>{
  let res: string = "";

  let reader = src.getReader();
  try {
    let done = false;

    while(done == false){
      let next = await reader.read();
      done = next.done;
      if(!done) res += selector(next.value);     
    }
  } finally {
    // Always cancel the reader to ensure proper cleanup of resources
    try {
      await reader.cancel();
    } catch (e) {
      // Ignore cancellation errors (stream might already be closed)
    }
    reader.releaseLock();
  }
  return res;
}