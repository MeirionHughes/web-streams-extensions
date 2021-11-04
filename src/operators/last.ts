export function last<T>(selector:(chunk:T)=>boolean=()=>true): (src: ReadableStream<T>) => ReadableStream<T> {
  return function(src:ReadableStream<T>){
    let reader = src.getReader();
    let last;
    return new ReadableStream<T>({
      async start(controller){        
        while(reader){
          let next = await reader.read();
          if(reader == null){
            //cancelled
            controller.close();
            return;
          }          
          if(next.done){ 
            controller.enqueue(last);
            controller.close();
            return;
          }
          if(selector(next.value)){
            last = next.value;
          }  
        }
      },
      cancel(reason?:any){
        reader.cancel(reason);
        reader.releaseLock();
        reader = null;
      }    
    })
  }
}