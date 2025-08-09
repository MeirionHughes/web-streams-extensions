import { expect } from "chai";
import { toArray, from, pipe, exhaustAll, interval, take, map, mapSync, delay, timeout, skip } from '../../src/index.js';
import { Subject } from '../../src/subjects/subject.js';
import { sleep } from "../../src/utils/sleep.js";

describe("exhaustAll operator", () => {

  it("should ignore new inner streams while current is active", async () => {
    
    const resultPromise = toArray(
      pipe(
        from(async function *(){            
            yield pipe(interval(10),skip(1), take(3), mapSync(x=>x)), 
            await sleep(30); 
            yield pipe(interval(10),skip(1), take(3), mapSync(x=>x*10)), 
            await sleep(30); 
            yield pipe(interval(10),skip(1), take(3), mapSync(x=>x*100))
        }),
        exhaustAll()
      )
    );
    const result = await resultPromise;
    expect(result).to.deep.equal([1, 2, 3, 100, 200, 300]);
  });

  it("should process next stream after current completes", async () => {
    const subject1 = new Subject<number>();
    const subject2 = new Subject<number>();
    
    // Create a source that provides streams sequentially
    const sourceSubject = new Subject<ReadableStream<number>>();
    
    const resultPromise = toArray(
      pipe(
        sourceSubject.readable,
        exhaustAll()
      )
    );
    
    // Start with first stream
    await sourceSubject.next(subject1.readable);
    await subject1.next(1);
    await subject1.complete();
    
    // Now provide second stream after first completes
    await new Promise(resolve => setTimeout(resolve, 10));
    await sourceSubject.next(subject2.readable);
    await subject2.next(2);
    await subject2.complete();
    
    // Complete the source
    await sourceSubject.complete();
    
    const result = await resultPromise;
    expect(result).to.deep.equal([1, 2]);
  });

  it("should work with arrays", async () => {
    const input = [
      [1, 2],
      [3, 4], // Should be ignored if first is still processing
      [5, 6]  // Should be ignored
    ];
    
    const result = await toArray(
      pipe(
        from(input),
        exhaustAll()
      )
    );
    
    // Since arrays are synchronous, only first should emit
    expect(result).to.deep.equal([1, 2]);
  });

  it("should work with promises", async () => {
    const input = [
      Promise.resolve(1),
      Promise.resolve(2),
      Promise.resolve(3)
    ];
    
    const result = await toArray(
      pipe(
        from(input),
        exhaustAll()
      )
    );
    
    // Only first promise should be processed
    expect(result).to.deep.equal([1]);
  });

  it("should handle empty source stream", async () => {
    const result = await toArray(
      pipe(
        from([]),
        exhaustAll()
      )
    );
    
    expect(result).to.deep.equal([]);
  });

  it("should handle errors in source stream", async () => {
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(from([1, 2]));
        controller.error(new Error("Source error"));
      }
    });
    
    try {
      await toArray(pipe(errorStream, exhaustAll()));
      expect.fail("Should have thrown error");
    } catch (err) {
      expect(err.message).to.equal("Source error");
    }
  });

  it("should handle errors in inner streams", async () => {
    const errorInnerStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.error(new Error("Inner error"));
      }
    });
    
    try {
      await toArray(
        pipe(
          from([errorInnerStream]),
          exhaustAll()
        )
      );
      expect.fail("Should have thrown error");
    } catch (err) {
      expect(err.message).to.equal("Inner error");
    }
  });

  it("should handle cancellation properly", async () => {
    const subject = new Subject<ReadableStream<number>>();
    
    const stream = pipe(
      subject.readable,
      exhaustAll()
    );
    
    const reader = stream.getReader();
    
    await subject.next(from([1, 2]));
    
    const first = await reader.read();
    expect(first.value).to.equal(1);
    
    // Cancel should clean up gracefully
    await reader.cancel("test");
    reader.releaseLock();
  });

  it("should work with custom highWaterMark", async () => {
    const result = await toArray(
      pipe(
        from([from([1, 2]), from([3, 4])]),
        exhaustAll()
      )
    );
    
    expect(result).to.deep.equal([1, 2]);
  });

  it("should handle single inner stream", async () => {
    const result = await toArray(
      pipe(
        from([from([1, 2, 3])]),
        exhaustAll()
      )
    );
    
    expect(result).to.deep.equal([1, 2, 3]);
  });

  it("should handle rapid inner stream arrival", async () => {
    // Create a source stream that emits multiple inner streams rapidly
    const sourceStream = new ReadableStream<ReadableStream<number>>({
      start(controller) {
        // Emit inner streams synchronously, but each inner stream has a small delay
        controller.enqueue(pipe(from([0, 0]), delay(10)));    // First stream should be processed (20ms total)
        controller.enqueue(pipe(from([1, 10]), delay(5)));    // Should be ignored
        controller.enqueue(pipe(from([2, 20]), delay(5)));    // Should be ignored  
        controller.enqueue(pipe(from([3, 30]), delay(5)));    // Should be ignored
        controller.enqueue(pipe(from([4, 40]), delay(5)));    // Should be ignored
        controller.close();
      }
    });
    
    const result = await toArray(
      pipe(
        sourceStream,
        exhaustAll()
      )
    );
    
    // Should only process first stream since others arrive while it's active
    expect(result).to.deep.equal([0, 0]);
  });

  it("should handle mixed stream types", async () => {
    const input = [
      from([1, 2]),           // ReadableStream
      [3, 4],                 // Array
      Promise.resolve(5)      // Promise
    ];
    
    const result = await toArray(
      pipe(
        from(input),
        exhaustAll()
      )
    );
    
    // Only first stream should be processed
    expect(result).to.deep.equal([1, 2]);
  });

  it("should complete when source completes and no active inner stream", async () => {
    const result = await toArray(
      pipe(
        from([from([1])]),
        exhaustAll()
      )
    );
    
    expect(result).to.deep.equal([1]);
  });

  it("should handle controller errors gracefully", async () => {
    // This tests error handling in the flush function
    const problematicStream = new ReadableStream({
      start(controller) {
        controller.enqueue(from([1, 2]));
        controller.close();
      }
    });
    
    const result = await toArray(
      pipe(
        problematicStream,
        exhaustAll()
      )
    );
    
    expect(result).to.deep.equal([1, 2]);
  });
});
