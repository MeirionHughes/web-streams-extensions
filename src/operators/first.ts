export function first<T>(selector:(chunk:T)=>boolean=()=>true): (src: ReadableStream<T>) => ReadableStream<T> {
  return function(src:ReadableStream<T>){
    let reader = src.getReader();
    return new ReadableStream<T>({
      async start(controller){           
        while(reader != null){
          let next = await reader.read();

          if(reader == null || next.done){
            reader = null;
            controller.close();
            return;
          }

          if(selector(next.value)){
            controller.enqueue(next.value);
            controller.close();
            reader.releaseLock();
            reader = null;
            return;
          }          
        }
      },
      cancel(){
        reader.releaseLock();
        reader = null;
      }    
    })
  }
}