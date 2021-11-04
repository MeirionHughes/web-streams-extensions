export function join<A, B, R>(srcA: ReadableStream<A>, srcB: ReadableStream<B>, selector: (a: A, b:B)=>R ): ReadableStream<R>{
  let readerA: ReadableStreamDefaultReader<A> = null;
  let readerB: ReadableStreamDefaultReader<B> = null;

  return new ReadableStream<R>({
    async start(){
       readerA = srcA.getReader();
       readerB = srcB.getReader();
    },
    async pull(controller){
      let nexts = await Promise.all([readerA.read(), readerB.read()]);
      let done = nexts[0].done || nexts[1].done;
      if(done){
        controller.close();
        if(nexts[0].done == false) readerA.releaseLock();
        if(nexts[1].done == false) readerB.releaseLock();
      }else{
        controller.enqueue(selector(nexts[0].value, nexts[1].value));
      }      
    },
    async cancel(reason?:any){
      if(readerA) {
        readerA.cancel(reason);
        readerA.releaseLock();
        readerA = null;
      }
      if(readerB) {
        readerB.cancel(reason);
        readerB.releaseLock();
        readerB = null;
      }
    }
  });   
}