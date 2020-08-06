/** return a promise that resolves once the stream is exhausted. 
 * @returns last value;
 */
export async function toPromise<T>(src: ReadableStream<T>): Promise<T>{
  let res:T = undefined;

  let reader = src.getReader();
  let done = false;

  while(done == false){
    let next = await reader.read();
    done = next.done;
    if(!done) res = next.value;   
  }
  return res;
}