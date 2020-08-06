export async function first<T>(src: ReadableStream<T>): Promise<T>{
  let reader = src.getReader();
  let next = await reader.read();   
  reader.releaseLock();
  return next.value;
}