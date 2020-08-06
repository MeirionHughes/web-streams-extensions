export function filter<T>(src: ReadableStream<T>, predicate:(chunk:T)=>boolean){
  return src.pipeThrough(new TransformStream({
    transform(chunk, controller){
      if(predicate(chunk)) controller.enqueue(chunk);
    }
  }))
}