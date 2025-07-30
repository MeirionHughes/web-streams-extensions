
let count = 0;
let writable = new WritableStream({
    write(chunk, controller){
        if(++count > 2 ) controller.error("I've aborted");
    }    
});

let readable = new ReadableStream({
    start(controller){
        controller.enqueue(1);
        controller.enqueue(2);
        controller.enqueue(3);
        controller.enqueue(4);
    },
    cancel(reason){
        console.log("cancelled:", reason );
    }
})
try{
await readable.pipeTo(writable);
}catch(err){
    console.log("caught:", err);
}