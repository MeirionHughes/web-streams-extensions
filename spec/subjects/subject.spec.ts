import { expect } from "chai";
import { first, from, map, pipe, take, tap, toArray, toPromise } from '../../src/index.js';
import { Subject } from "../../src/subjects/subject.js";
import { sleep } from '../../src/utils/sleep.js';


describe("subject", () => {
  it("can observe with multiple readers - manual write", async () => {
    let input = [1, 2, 3, 4];
    let expected1 = input.slice();
    let expected2 = input.map(x => x * 2);
    let expected3 = input[0];

    let subject = new Subject<number>();

    let resultPromise1 = toArray(subject.readable);
    let resultPromise2 = toArray(pipe(subject.readable, map(x => x * 2)));
    let resultPromise3 = toPromise(pipe(subject.readable, take(1)));

    subject.next(1);
    subject.next(2);
    subject.next(3);
    subject.next(4);
    subject.complete();

    let result1 = await resultPromise1;
    let result2 = await resultPromise2;
    let result3 = await resultPromise3;

    expect(result1).to.be.deep.eq(expected1);
    expect(result2).to.be.deep.eq(expected2);
    expect(result3).to.be.deep.eq(expected3);
  })

  it("can observe with multiple readers - ending one doesn't affect other", async () => {
    let input = [1, 2, 3, 4];
    let expected1 = input.slice();
    let expected2 = input.slice(0, 2);

    let sub = new Subject<number>();

    let resultPromise1 = toArray(sub);
    let resultPromise2 = toArray(pipe(sub.readable, take(2)));

    for (let item of input) {
      await sub.next(item);
    }
    await sub.complete();

    let result1 = await resultPromise1;
    let result2 = await resultPromise2;


    expect(result1).to.be.deep.eq(expected1);
    expect(result2).to.be.deep.eq(expected2);
  })

  it("can observe with multiple readers - cancelling one does not cancel subject", async () => {
    let input = [1, 2, 3, 4];
    let expected1 = input.slice();
    let expected2 = input.slice(0, 2);

    let sub = new Subject<number>();

    let resultPromise1 = toArray(sub);

    let reader = sub.readable.getReader();

    reader.cancel('foo');

    for (let item of input) {
      await sub.next(item);
    }
    await sub.complete();

    let result1 = await resultPromise1;

    expect(result1).to.be.deep.eq(expected1);
  })

  it("completing a subject stops pipe through", async () => {
    let src = new Subject();
    let subject = new Subject();
    let pulled = [];

    // Start the pipe operation and handle potential errors
    const pipePromise = pipe(src.readable).pipeTo(subject.writable).catch((error) => {
      // Expected: pipe will fail when subject is completed
    });

    let outputTask = toArray(subject.readable);
    let outputTask2 = toArray(src.readable);

    // Emit value and ensure it's processed
    await src.next(1);
    
    // Small delay to ensure the value has been piped through
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Now complete the subject to stop the pipe
    await subject.complete();
    
    // Emit more values to source
    await src.next(2);
    await src.complete();

    // Wait for pipe to complete/fail
    await pipePromise;

    let result = await outputTask;
    let result2 = await outputTask2;

    expect(result).to.be.deep.eq([1]);
    expect(result2).to.be.deep.eq([1, 2]);
  })  
  
  it("completing a subject stops pipe through and preceding pipes", async () => {
    let src = new Subject();
    let subject = new Subject();
    let pulled = [];

    const pipePromise = pipe(src.readable, tap(x=>{
      pulled.push(x);   
    })).pipeTo(subject.writable);

    let outputTask = toArray(subject.readable);

    await src.next(1);
    await sleep(1);
    await subject.complete();
    
    // The pipe should be aborted now, so these next() calls
    // should not cause issues
    for(let i=2; i< 20; i++){
      await src.next(i);
    }
    await src.complete();
    
    // Wait for the pipe to finish (it should error/abort)
    try {
      await pipePromise;
    } catch (error) {
      // Expected: the pipe should error when subject closes
    }
    
    await sleep(1);

    let result = await outputTask;

    expect(result).to.be.deep.eq([1]);
    expect(pulled).to.be.deep.eq([1,2,3]);//pulled 2 more (highwater) before being aborted by writer controller
  })


  it("completing a writable completes subject", async () => {
    let subject = new Subject();

    const pipePromise = pipe(from([1, 2, 3, 4])).pipeTo(subject.writable);

    let result = await toArray(subject.readable);

    // Wait for pipe to complete
    await pipePromise;

    expect(result).to.be.deep.eq([1, 2, 3, 4]);
    expect(subject.closed).to.be.true;
  })

  it("erroring a writable errors the subscribers", async () => {
    let subject = new Subject();
    let result = null;

    const pipePromise = pipe(new ReadableStream({
      start(controller) {
      },
      pull(controller) {
        controller.error("foo");
      }
    })).pipeTo(subject.writable).catch((error) => {
      // Handle pipe error
    });

    try {
      let result = await toArray(subject.readable);
    } catch (err) {
      result = err;
    }

    // Wait for pipe to complete
    await pipePromise;

    expect(result).to.be.eq('foo');
  })

  it("can pipeTo", async () => {
    let input = [1, 2, 3, 4];
    let expected1 = input.slice();
    let expected2 = input.map(x => x * 2);
    let expected3 = input[0];

    let subject = new Subject<number>();

    let resultPromise1 = toArray(subject.readable);
    let resultPromise2 = toArray(pipe(subject.readable, map(x => x * 2)));
    let resultPromise3 = toPromise(pipe(subject.readable, take(1)));

    from(input).pipeTo(subject.writable);

    let result1 = await resultPromise1;
    let result2 = await resultPromise2;
    let result3 = await resultPromise3;

    expect(result1).to.be.deep.eq(expected1);
    expect(result2).to.be.deep.eq(expected2);
    expect(result3).to.be.deep.eq(expected3);
  })

  it("can pipeThrough", async () => {
    let input = [1, 2, 3, 4];
    let expected = input.slice();
    let subject = new Subject<number>();
    let result = await toArray(from(input).pipeThrough(subject));

    expect(result).to.be.deep.eq(expected);
  })

  it("can complete without having to await the promise ", async () => {
    let expected = [14, 2, 9, 1];
    let src = new Subject();
    let resultTask = toArray(src.readable);
    for (let input of expected) src.next(input);
    src.complete();
    let result = await resultTask;
    expect(result).to.be.deep.eq(expected);
  })

  it("will error writable reason if writable is aborted", async ()=>{
    let subjectA = new Subject<number>()
    let subjectB = new Subject<number>();

    // Get a writer on subjectB first to keep the writable unlocked
    let writer = subjectB.writable.getWriter();
    
    let result = toArray(subjectB.readable);
    let error = null;

    // Abort the writer instead of the stream directly
    writer.abort("foobar");

    try{
      await result;      
    }
    catch(err){
      error = err;
    }

    expect(error).to.not.be.null;
    expect(error).to.equal("foobar");
    expect(subjectB.closed).to.be.true;
  })

  it("is not required to close subject for readers to complete", async ()=>{
    let subjectA = new Subject<number>();
    let input = 10;
    let task = toPromise(pipe(subjectA, first()));

    subjectA.next(input);

    let result = await task;

    expect(result).to.be.equal(input)    
  })

  it("manually completing subject cancels piped ReadableStream", async () => {
    let subject = new Subject<number>();
    let cancelled = false;
    let cancelReason = null;

    let startResolve = null;
    let startPromise = new Promise((resolve, reject) => { startResolve = resolve });

    // Create a ReadableStream that tracks if it was cancelled
    let sourceStream = new ReadableStream({
      async start(controller) {
        await startPromise;
        for(let i=0; i< 100; i++){
          await controller.enqueue(i);
        }
      },
      cancel(reason) {
        cancelled = true;
        cancelReason = reason;
      }
    });
 
    let pipePromise = sourceStream.pipeTo(subject.writable);

    // Immediately complete the subject - the cancel will only be called when trying to write
    await subject.complete();

    // Now have the readable try to send data
    startResolve();

    // Wait for the pipe promise to complete/fail
    try {
      await pipePromise;
    } catch (err) {
      // Expected to fail due to subject being closed
    }

    // Verify the source stream was cancelled
    expect(cancelled).to.be.true;
    expect(cancelReason).to.not.be.null;
  })
})
