export async function toArray<T>(src: ReadableStream<T>): Promise<T[]>{
  let res: T[] = [];

  let reader = src.getReader();
  let done = false;

  while(done == false){
    let next = await reader.read();
    done = next.done;
    if(!done) res.push(next.value);     
  }
  return res;
}