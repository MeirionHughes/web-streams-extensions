import { expect } from "chai";
import { toArray, from, pipe, first } from '../../src/index.js';
import { Subject } from "../../src/subject.js";

describe("first", () => {
  it("can get the first element of stream", async () => {
    let inputA = [1, 2, 3, 4];
    let expected = [1]

    let result = await toArray(
      pipe(
        from(inputA),
        first())
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })

  it("should get first element matching predicate", async () => {
    let input = [1, 3, 2, 4];
    let expected = [2];

    let result = await toArray(
      pipe(
        from(input),
        first(x => x % 2 === 0)
      )
    );

    expect(result).to.deep.equal(expected);
  })

  it("should handle empty stream", async () => {
    let result = await toArray(
      pipe(
        from([]),
        first()
      )
    );

    expect(result).to.deep.equal([]);
  })

  it("should handle no elements matching predicate", async () => {
    let input = [1, 3, 5, 7];
    
    let result = await toArray(
      pipe(
        from(input),
        first(x => x % 2 === 0)
      )
    );

    expect(result).to.deep.equal([]);
  })

  it("should work with complex predicate", async () => {
    let input = ["apple", "banana", "cherry", "date"];
    let expected = ["banana"];

    let result = await toArray(
      pipe(
        from(input),
        first(x => x.length > 5)
      )
    );

    expect(result).to.deep.equal(expected);
  })

  it("should handle predicate errors", async () => {
    let input = [1, 2, 3];

    try {
      await toArray(
        pipe(
          from(input),
          first(x => {
            if (x === 2) throw new Error("Predicate error");
            return x === 2; // Only match the element that will throw
          })
        )
      );
      expect.fail("Should have thrown an error");
    } catch (err: any) {
      expect(err.message).to.equal("Predicate error");
    }
  })

  it("should work with different types", async () => {
    let input = [{ id: 1 }, { id: 2 }, { id: 3 }];
    let expected = [{ id: 2 }];

    let result = await toArray(
      pipe(
        from(input),
        first(x => x.id === 2)
      )
    );

    expect(result).to.deep.equal(expected);
  })

  it("should handle async streams", async () => {
    async function* asyncGenerator() {
      yield 1;
      yield 2;
      yield 3;
    }

    let result = await toArray(
      pipe(
        from(asyncGenerator()),
        first(x => x > 1)
      )
    );

    expect(result).to.deep.equal([2]);
  })

  it("should handle stream errors", async () => {
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.error(new Error("Stream error"));
      }
    });

    try {
      await toArray(
        pipe(
          errorStream,
          first()
        )
      );
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.equal("Stream error");
    }
  })

  it("should handle cancellation", async () => {
    const subject = new Subject<number>();
    
    const stream = pipe(
      subject.readable,
      first(x => x > 5)
    );
    
    const reader = stream.getReader();
    
    // Add some values that don't match
    await subject.next(1);
    await subject.next(2);
    
    // Cancel the reader
    await reader.cancel("Test cancellation");
    reader.releaseLock();
    
    // Complete the subject
    await subject.complete();
  })

  it("should handle cleanup errors during cancellation", async () => {
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.enqueue(2);
      },
      cancel() {
        throw new Error("Cancel error");
      }
    });

    const stream = pipe(
      errorStream,
      first()
    );
    
    const reader = stream.getReader();
    
    // Read first value to trigger completion and cleanup
    const result = await reader.read();
    expect(result.value).to.equal(1);
    expect(result.done).to.be.false;
    
    // Should complete after first
    const done = await reader.read();
    expect(done.done).to.be.true;
    
    reader.releaseLock();
  })

  it("should handle cleanup errors during error", async () => {
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        setTimeout(() => controller.error(new Error("Stream error")), 10);
      },
      cancel() {
        throw new Error("Cancel error");
      }
    });

    try {
      await toArray(
        pipe(
          errorStream,
          first(x => x > 1) // Won't match first value, will wait for error
        )
      );
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.equal("Stream error");
    }
  })

  it("should work with custom highWaterMark", async () => {
    let result = await toArray(
      first()(
        from([1, 2, 3]),
        { highWaterMark: 1 }
      )
    );

    expect(result).to.deep.equal([1]);
  })

  it("should handle boolean values", async () => {
    let input = [false, true, false];
    let expected = [true];

    let result = await toArray(
      pipe(
        from(input),
        first(x => x === true)
      )
    );

    expect(result).to.deep.equal(expected);
  })

  it("should handle null and undefined values", async () => {
    let input = [null, undefined, 1, 2];
    let expected = [1];

    let result = await toArray(
      pipe(
        from(input),
        first(x => x != null)
      )
    );

    expect(result).to.deep.equal(expected);
  })

  it("should work with single element stream", async () => {
    let result = await toArray(
      pipe(
        from([42]),
        first()
      )
    );

    expect(result).to.deep.equal([42]);
  })

  it("should handle very large stream efficiently", async () => {
    async function* largeGenerator() {
      for (let i = 1; i <= 1000000; i++) {
        yield i;
      }
    }

    let result = await toArray(
      pipe(
        from(largeGenerator()),
        first(x => x === 1000)
      )
    );

    expect(result).to.deep.equal([1000]);
  })

  it("should handle early reader release scenario", async () => {
    const subject = new Subject<number>();
    
    const stream = pipe(
      subject.readable,
      first()
    );
    
    const reader = stream.getReader();
    
    // Add a value
    await subject.next(42);
    
    // Read should complete immediately
    const result = await reader.read();
    expect(result.value).to.equal(42);
    expect(result.done).to.be.false;
    
    // Next read should be done
    const done = await reader.read();
    expect(done.done).to.be.true;
    
    reader.releaseLock();
    await subject.complete();
  })

  it("should handle default selector", async () => {
    let input = [0, false, null, undefined, 1];
    let expected = [0]; // First element, regardless of truthiness

    let result = await toArray(
      pipe(
        from(input),
        first() // No selector, should return first element
      )
    );

    expect(result).to.deep.equal(expected);
  })
});
