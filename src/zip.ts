
/**
 * zip multiple sources together creating a tuple 
 * 
 * a - b - c - d - e - f
 * @param sources 
 */
export function zip<T>(sources: ReadableStream<T>[] ): ReadableStream<T[]>{
  let readers: ReadableStreamDefaultReader<T>[] = null;

  return new ReadableStream<T[]>({
    async start(){
       readers = sources.map(s=>s.getReader());
    },
    async pull(controller){
      let nexts = await Promise.all(readers.map(r=>r.read()));
      let done = nexts.reduce((p, c)=>p || c.done, false);
      if(done){
        controller.close();
        nexts.forEach((next, index)=>{
          if(next.done === false) readers[index].releaseLock();
        })
        readers = null;
      }else{
        controller.enqueue(nexts.map(n=>n.value));        
      }      
    },
    async cancel(){
      if(readers!=null){
        readers.forEach(reader=>reader.cancel());      
      }  
    }
  });   
}