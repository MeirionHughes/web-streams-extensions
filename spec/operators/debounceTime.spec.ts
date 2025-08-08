import { expect } from "chai";
import { sleep } from "../../src/utils/sleep.js";
import { toArray, from, pipe, buffer, take, debounceTime, tap } from '../../src/index.js';
import { Subject } from "../../src/subject.js";

describe("debounceTime", () => {
  it("can buffer T while producing faster than duration", async () => {

    let input = [1,2,3,4,5,6,7,8];
    let expected = [input.slice(0, input.length)];

    let src = from(async function*(){
      for(let item of input){
        await sleep(5);
        yield item;
      }
    }());

    let result = await toArray(
      pipe(
        src,
        debounceTime(10)
      )
    )

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })

  it("can debounce and yield buffer if duration expires", async () => {

    let input = [1,2,3,4,5,6,7,8];
    let mid = 4;
    let expected = [input.slice(0, mid), input.slice(mid)];

    let src = from(async function*(){
      for(let index = 0; index < input.length; index++){
        let item = input[index];
        if(index == mid){
          await sleep(15);
        }else{
          await sleep(5);
        }
        yield item;
      }
    }());

    let result = await toArray(
      pipe(
        src,
        debounceTime(10)
      )
    )

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })

  it("can debounce and yield buffer if duration expires, exit early", async () => {

    let input = [1,2,3,4,5,6,7,8];
    let pulled = [];
    let mid = 4;
    let expected = [input.slice(0, mid)];

    let src = from(async function*(){
      for(let index = 0; index < input.length; index++){
        let item = input[index];
        if(index == mid){
          await sleep(15);
        }else{
          await sleep(5);
        }
        yield item;
      }
    }());

    let result = await toArray(
      pipe(
        src,
        debounceTime(10),
        tap(x=>pulled.push(x)),
        take(1)
      )
    )

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
    expect(pulled, "only pulled one").to.be.deep.eq(expected);
  })

  it("should throw error for zero or negative duration", () => {
    expect(() => debounceTime(0)).to.throw("Debounce duration must be positive");
    expect(() => debounceTime(-1)).to.throw("Debounce duration must be positive");
  })

  it("should handle empty stream", async () => {
    let result = await toArray(
      pipe(
        from([]),
        debounceTime(10)
      )
    );

    expect(result).to.deep.equal([]);
  })

  it("should handle single value", async () => {
    let result = await toArray(
      pipe(
        from([42]),
        debounceTime(10)
      )
    );

    expect(result).to.deep.equal([[42]]);
  })

  it("should handle stream errors", async () => {
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        setTimeout(() => controller.error(new Error("Stream error")), 20);
      }
    });

    try {
      await toArray(
        pipe(
          errorStream,
          debounceTime(10)
        )
      );
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.equal("Stream error");
    }
  })

  it("should handle cancellation properly", async () => {
    const subject = new Subject<number>();
    
    const stream = pipe(
      subject.readable,
      debounceTime(100)
    );
    
    const reader = stream.getReader();
    
    // Add some values
    await subject.next(1);
    await subject.next(2);
    
    // Cancel before debounce period expires
    await reader.cancel("Test cancellation");
    reader.releaseLock();
    
    await subject.complete();
  })

  it("should emit final buffer on stream completion", async () => {
    const subject = new Subject<number>();
    
    const resultPromise = toArray(
      pipe(
        subject.readable,
        debounceTime(100)
      )
    );
    
    // Add values and complete immediately
    await subject.next(1);
    await subject.next(2);
    await subject.complete();
    
    const result = await resultPromise;
    expect(result).to.deep.equal([[1, 2]]);
  })

  it("should handle very short debounce time", async () => {
    let result = await toArray(
      pipe(
        from([1, 2, 3]),
        debounceTime(1)
      )
    );

    // With very short debounce, values might be grouped differently
    expect(result.flat().sort()).to.deep.equal([1, 2, 3]);
  })

  it("should handle very long debounce time", async () => {
    let src = from(async function*() {
      yield 1;
      await sleep(5);
      yield 2;
      await sleep(5);
      yield 3;
    }());

    let result = await toArray(
      pipe(
        src,
        debounceTime(1000)
      )
    );

    expect(result).to.deep.equal([[1, 2, 3]]);
  })

  it("should work with custom highWaterMark", async () => {
    let result = await toArray(
      debounceTime(10)(
        from([1, 2, 3]),
        { highWaterMark: 1 }
      )
    );

    expect(result).to.deep.equal([[1, 2, 3]]);
  })

  it("should handle rapid emissions with delayed completion", async () => {
    const subject = new Subject<number>();
    
    const resultPromise = toArray(
      pipe(
        subject.readable,
        debounceTime(50)
      )
    );
    
    // Emit values rapidly
    await subject.next(1);
    await subject.next(2);
    await subject.next(3);
    
    // Wait longer than debounce time, then complete
    await sleep(100);
    await subject.complete();
    
    const result = await resultPromise;
    expect(result).to.deep.equal([[1, 2, 3]]);
  })

  it("should handle multiple debounce periods", async () => {
    let input = [1, 2, 3, 4, 5, 6];
    let expected = [[1, 2], [3, 4], [5, 6]];

    let src = from(async function*() {
      for (let i = 0; i < input.length; i++) {
        yield input[i];
        if (i % 2 === 1 && i < input.length - 1) {
          await sleep(25); // Longer than debounce time
        } else {
          await sleep(5); // Shorter than debounce time
        }
      }
    }());

    let result = await toArray(
      pipe(
        src,
        debounceTime(15)
      )
    );

    expect(result).to.deep.equal(expected);
  })

  it("should handle controller close errors gracefully", async () => {
    const subject = new Subject<number>();
    
    const stream = pipe(
      subject.readable,
      debounceTime(10)
    );
    
    const reader = stream.getReader();
    
    // Add a value
    await subject.next(1);
    
    // Read the value to trigger debounce
    setTimeout(async () => {
      await reader.read();
      reader.releaseLock();
    }, 5);
    
    // Complete the subject
    await subject.complete();
    await sleep(20); // Wait for debounce to trigger
  })

  it("should handle errors in reader cleanup", async () => {
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.error(new Error("Immediate error"));
      }
    });

    try {
      await toArray(
        pipe(
          errorStream,
          debounceTime(10)
        )
      );
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.equal("Immediate error");
    }
  })

  it("should handle timer cleanup on cancel", async () => {
    const subject = new Subject<number>();
    
    const stream = pipe(
      subject.readable,
      debounceTime(100)
    );
    
    const reader = stream.getReader();
    
    // Add value to start timer
    await subject.next(1);
    
    // Cancel immediately to test timer cleanup
    await reader.cancel("Cancel test");
    reader.releaseLock();
    
    await subject.complete();
  })

  it("should handle different data types", async () => {
    let input = ["a", "b", "c"];
    
    let result = await toArray(
      pipe(
        from(input),
        debounceTime(10)
      )
    );

    expect(result).to.deep.equal([["a", "b", "c"]]);
  })

  it("should handle objects and complex types", async () => {
    let input = [{ id: 1 }, { id: 2 }, { id: 3 }];
    
    let result = await toArray(
      pipe(
        from(input),
        debounceTime(10)
      )
    );

    expect(result).to.deep.equal([[{ id: 1 }, { id: 2 }, { id: 3 }]]);
  })
});
