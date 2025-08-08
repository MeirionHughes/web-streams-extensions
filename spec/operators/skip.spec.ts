import { expect } from "chai";
import { toArray, from, pipe, skip } from '../../src/index.js';
import { Subject } from '../../src/subjects/subject.js';

describe("skip", () => {
  it("can skip less than total ", async () => {
    let inputA = [1, 2, 3, 4, 5];
    let expected = [4, 5]

    let result = await toArray(
      pipe(
        from(inputA),
        skip(3))
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })

  it("can skip more than total ", async () => {
    let inputA = [1, 2, 3, 4, 5];
    let expected = []

    let result = await toArray(
      pipe(
        from(inputA),
        skip(10))
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })
  
  it("can skip none", async () => {
    let inputA = [1, 2, 3, 4, 5];
    let expected = [1, 2, 3, 4, 5]

    let result = await toArray(
      pipe(
        from(inputA),
        skip(0))
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })

  it("should handle negative skip count", async () => {
    let inputA = [1, 2, 3, 4, 5];
    let expected = [1, 2, 3, 4, 5]; // Negative skip should behave like skip(0)

    let result = await toArray(
      pipe(
        from(inputA),
        skip(-5))
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })

  it("should handle empty stream", async () => {
    let result = await toArray(
      pipe(
        from([]),
        skip(3))
    );

    expect(result).to.be.deep.eq([]);
  })

  it("should handle single element with skip", async () => {
    let result = await toArray(
      pipe(
        from([42]),
        skip(1))
    );

    expect(result).to.be.deep.eq([]);
  })

  it("should handle single element without skip", async () => {
    let result = await toArray(
      pipe(
        from([42]),
        skip(0))
    );

    expect(result).to.be.deep.eq([42]);
  })

  it("should handle stream errors", async () => {
    const errorMessage = "Source error";
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.enqueue(2);
        controller.error(new Error(errorMessage));
      }
    });

    try {
      await toArray(pipe(
        errorStream,
        skip(1)
      ));
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.equal(errorMessage);
    }
  })

  it("should handle cancellation properly", async () => {
    const subject = new Subject<number>();
    
    const stream = pipe(
      subject.readable,
      skip(2)
    );
    
    const reader = stream.getReader();
    
    // Emit values, but they'll be skipped
    await subject.next(1);
    await subject.next(2);
    await subject.next(3); // This should come through
    
    const first = await reader.read();
    expect(first.value).to.equal(3);
    
    // Cancel the reader
    await reader.cancel("Test cancellation");
    reader.releaseLock();
    
    // Further values should not be processed
    await subject.next(4);
    await subject.complete();
  })

  it("should work with custom highWaterMark", async () => {
    let inputA = [1, 2, 3, 4, 5];
    let expected = [3, 4, 5]

    let result = await toArray(
      skip(2)(
        from(inputA),
        { highWaterMark: 1 }
      )
    );

    expect(result).to.be.deep.eq(expected);
  })

  it("should handle backpressure correctly", async () => {
    const subject = new Subject<number>();
    
    const stream = pipe(
      subject.readable,
      skip(2)
    );
    
    const reader = stream.getReader();
    const results: number[] = [];
    
    // Emit values
    await subject.next(1); // skipped
    await subject.next(2); // skipped
    await subject.next(3); // passed through
    await subject.next(4); // passed through
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
    
    expect(results).to.deep.equal([3, 4]);
  })

  it("should handle reader cleanup errors during cancel", async () => {
    const subject = new Subject<number>();
    
    const stream = pipe(
      subject.readable,
      skip(1)
    );
    
    const reader = stream.getReader();
    
    await subject.next(1); // skipped
    await subject.next(2); // passed through
    
    const first = await reader.read();
    expect(first.value).to.equal(2);
    
    // Cancel should handle cleanup gracefully
    await reader.cancel("test");
    reader.releaseLock();
  })

  it("should work with different data types", async () => {
    const strings = ["a", "b", "c", "d", "e"];
    const expected = ["c", "d", "e"];

    const result = await toArray(
      pipe(
        from(strings),
        skip(2)
      )
    );

    expect(result).to.deep.equal(expected);
  })

  it("should skip exactly the specified count", async () => {
    const subject = new Subject<number>();
    
    const resultPromise = toArray(
      pipe(
        subject.readable,
        skip(3)
      )
    );
    
    // Emit more values than skip count
    for (let i = 1; i <= 10; i++) {
      await subject.next(i);
    }
    await subject.complete();
    
    const result = await resultPromise;
    
    // Should skip first 3, then emit the rest
    expect(result).to.deep.equal([4, 5, 6, 7, 8, 9, 10]);
  })

  it("should handle very large skip count", async () => {
    const inputA = [1, 2, 3, 4, 5];
    const expected = [];

    const result = await toArray(
      pipe(
        from(inputA),
        skip(Number.MAX_SAFE_INTEGER)
      )
    );

    expect(result).to.deep.equal(expected);
  })

  it("should handle skip with async stream source", async () => {
    const subject = new Subject<number>();
    
    const stream = pipe(
      subject.readable,
      skip(2)
    );
    
    const reader = stream.getReader();
    
    // Emit values asynchronously
    setTimeout(() => subject.next(1), 10); // skipped
    setTimeout(() => subject.next(2), 20); // skipped  
    setTimeout(() => subject.next(3), 30); // passed through
    setTimeout(() => subject.complete(), 40);
    
    const first = await reader.read();
    expect(first.value).to.equal(3);
    
    const second = await reader.read();
    expect(second.done).to.be.true;
    
    reader.releaseLock();
  })

  it("should handle stream completion during skip phase", async () => {
    const result = await toArray(
      pipe(
        from([1, 2]), // Only 2 elements
        skip(5) // Skip more than available
      )
    );

    expect(result).to.deep.equal([]); // Should be empty
  })

  it("should maintain correct skip count across multiple reads", async () => {
    const subject = new Subject<number>();
    
    const stream = pipe(
      subject.readable,
      skip(3)
    );
    
    const reader = stream.getReader();
    
    // Emit one at a time and verify skipping behavior
    await subject.next(1); // skip count: 3 -> 2
    await subject.next(2); // skip count: 2 -> 1  
    await subject.next(3); // skip count: 1 -> 0
    await subject.next(4); // skip count: 0, emit this
    
    const first = await reader.read();
    expect(first.value).to.equal(4);
    
    // Further values should pass through
    await subject.next(5);
    const second = await reader.read();
    expect(second.value).to.equal(5);
    
    await subject.complete();
    const final = await reader.read();
    expect(final.done).to.be.true;
    
    reader.releaseLock();
  })
});
