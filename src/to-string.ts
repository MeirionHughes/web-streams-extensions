/**
 * combines a stream of chunks to a string. */
export async function toString<T>(src: ReadableStream<T>, selector: (value:T)=>string = (value)=>value.toString()): Promise<string>{
  let res: string = "";

  let reader = src.getReader();
  let done = false;

  while(done == false){
    let next = await reader.read();
    done = next.done;
    if(!done) res += selector(next.value);     
  }
  return res;
}