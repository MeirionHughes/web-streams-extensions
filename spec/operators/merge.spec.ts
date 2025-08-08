import { expect } from "chai";
import { toArray, from, map, pipe, toPromise } from '../../src/index.js';
import { merge } from "../../src/operators/merge.js";
import { tap } from "../../src/operators/tap.js";
import { sleep } from "../../src/utils/sleep.js";
import { Subject } from "../../src/subjects/subject.js";

describe("merge", () => {
  it("can merge stream of promises, resolved", async () => {
    let input = [1, 2, 3, 4];
    let inputPromise = input.map(x => Promise.resolve(x));
    let expected = input.slice();

    let result = await toArray(
      pipe(
        from(inputPromise),
        merge())
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })
  
  it("can merge stream of promises, sorted by resolved time", async () => {
    let input = [
      sleep(400).then(_ => 1),
      sleep(200).then(_ => 2),
      sleep(300).then(_ => 3),
      sleep(100).then(_ => 4)
    ];
    let expected = [4, 2, 3, 1];

    let result = await toArray(
      pipe(
        from(input),
        merge())
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })

  it("can merge stream of streams", async () => {
    let sources = [
      pipe(from([1, 5, 10, 15]), map(async x => { await sleep(x); return x })),
      pipe(from([3, 8, 13, 19]), map(async x => { await sleep(x); return x }))
    ]
    let expected = [1, 3, 5, 8, 10, 13, 15, 19];

    let result = await toArray(
      pipe(
        from(sources),
        merge())
    );
    expect(result.length, "correct number of outputs").to.be.eq(expected.length);
    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })

  it("can merge streams, limited by concurrency", async () => {
    let sources = [
      pipe(from([1, 5, 10, 15]), map(async x => { await sleep(x); return x })),
      pipe(from([3, 8, 13, 19]), map(async x => { await sleep(x); return x }))
    ]
    let expected = [1, 5, 10, 15, 3, 8, 13, 19];

    let result = await toArray(
      pipe(
        from(sources),
        merge(1))
    );
    expect(result.length, "correct number of outputs").to.be.eq(expected.length);
    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })

  it("will start reading from the first stream if next element is delayed", async () => {
    let result = [];
    let err = null;
    try {
      await toPromise(
        pipe(
          new ReadableStream({
            async start(controller) {
              controller.enqueue(from([1, 2, 3, 4]));
              await sleep(100);
              controller.error("foo");
            }
          }),
          merge(),
          tap(x => result.push(x)))
      );
    }
    catch (_err) {
      err = _err;
    }

    // if it can't pull elements from the main stream while also 
    // concurrently iterating through its current queue, then 
    // we wouldn't see the initial values [1,2,3,4] before 
    // seeing the error being thrown... 

    expect(err).to.be.eq("foo");
    expect(result, "stream result matches expected").to.be.deep.eq([1, 2, 3, 4]);
  })

  it("should throw error for zero or negative concurrency", async () => {
    expect(() => merge(0)).to.throw("Concurrency limit must be greater than zero");
    expect(() => merge(-1)).to.throw("Concurrency limit must be greater than zero");
  })

  it("should handle empty source stream", async () => {
    let result = await toArray(
      pipe(
        from([]),
        merge()
      )
    );

    expect(result).to.deep.equal([]);
  })

  it("should handle stream errors in source", async () => {
    const errorStream = new ReadableStream({
      start(controller) {
        controller.error(new Error("Source error"));
      }
    });

    try {
      await toArray(
        pipe(
          errorStream,
          merge()
        )
      );
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.equal("Source error");
    }
  })

  it("should handle stream errors in inner streams", async () => {
    const errorInnerStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.error(new Error("Inner stream error"));
      }
    });

    const input = [from([1]), errorInnerStream];

    try {
      await toArray(
        pipe(
          from(input),
          merge()
        )
      );
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.equal("Inner stream error");
    }
  })

  it("should handle cancellation properly", async () => {
    const subject = new Subject<ReadableStream<number>>();
    
    const stream = pipe(
      subject.readable,
      merge()
    );
    
    const reader = stream.getReader();
    
    // Add a stream and read from it
    await subject.next(from([1, 2, 3]));
    
    const first = await reader.read();
    expect(first.value).to.equal(1);
    
    // Cancel the reader
    await reader.cancel("Test cancellation");
    reader.releaseLock();
    
    // Further streams should not be processed
    await subject.next(from([4, 5, 6]));
    await subject.complete();
  })

  it("should handle very high concurrency limit", async () => {
    let sources = [
      from([1, 2]),
      from([3, 4]),
      from([5, 6])
    ];

    let result = await toArray(
      pipe(
        from(sources),
        merge(1000) // Very high concurrency
      )
    );

    expect(result.sort()).to.deep.equal([1, 2, 3, 4, 5, 6]);
  })

  it("should handle single inner stream", async () => {
    let result = await toArray(
      pipe(
        from([from([1, 2, 3])]),
        merge()
      )
    );

    expect(result).to.deep.equal([1, 2, 3]);
  })

  it("should handle backpressure correctly", async () => {
    const subject = new Subject<ReadableStream<number>>();
    
    const stream = pipe(
      subject.readable,
      merge()
    );
    
    const reader = stream.getReader();
    const results: number[] = [];
    
    // Add streams
    await subject.next(from([1, 2]));
    await subject.next(from([3, 4]));
    await subject.complete();
    
    // Read all values
    try {
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        results.push(result.value);
      }
    } finally {
      reader.releaseLock();
    }
    
    expect(results.sort()).to.deep.equal([1, 2, 3, 4]);
  })

  it("should handle mix of promises and streams", async () => {
    let input = [
      Promise.resolve(1),
      from([2, 3]),
      Promise.resolve(4)
    ];

    let result = await toArray(
      pipe(
        from(input),
        merge()
      )
    );

    expect(result.sort()).to.deep.equal([1, 2, 3, 4]);
  })

  it("should handle rejected promises", async () => {
    let input = [
      Promise.resolve(1),
      Promise.reject(new Error("Promise error")),
      Promise.resolve(3)
    ];

    try {
      await toArray(
        pipe(
          from(input),
          merge()
        )
      );
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.equal("Promise error");
    }
  })

  it("should handle concurrency limit of 1", async () => {
    let sources = [
      pipe(from([1, 2]), map(async x => { await sleep(x * 10); return x })),
      pipe(from([3, 4]), map(async x => { await sleep(x * 10); return x }))
    ];

    let result = await toArray(
      pipe(
        from(sources),
        merge(1)
      )
    );

    // With concurrency 1, should process streams sequentially
    expect(result).to.deep.equal([1, 2, 3, 4]);
  })

  it("should handle stream completion during merge", async () => {
    const subject1 = new Subject<number>();
    const subject2 = new Subject<number>();
    
    const resultPromise = toArray(
      pipe(
        from([subject1.readable, subject2.readable]),
        merge()
      )
    );
    
    // Complete streams in different order
    await subject2.next(2);
    await subject2.complete();
    
    await subject1.next(1);
    await subject1.complete();
    
    const result = await resultPromise;
    expect(result.sort()).to.deep.equal([1, 2]);
  })

  it("should handle async processing of inner streams", async () => {
    const subject1 = new Subject<number>();
    const subject2 = new Subject<number>();
    
    const resultPromise = toArray(
      pipe(
        from([subject1.readable, subject2.readable]),
        merge()
      )
    );
    
    // Process streams asynchronously
    setTimeout(async () => {
      await subject1.next(1);
      await subject1.complete();
    }, 10);
    
    setTimeout(async () => {
      await subject2.next(2);
      await subject2.complete();
    }, 20);
    
    const result = await resultPromise;
    expect(result.sort()).to.deep.equal([1, 2]);
  })

  it("should handle errors in queue processing", async () => {
    // This test covers error handling in queue operations
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        setTimeout(() => controller.error(new Error("Delayed error")), 50);
      }
    });

    try {
      await toArray(
        pipe(
          from([errorStream]),
          merge()
        )
      );
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.equal("Delayed error");
    }
  })
});
