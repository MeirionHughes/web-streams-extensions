import { expect } from "chai";
import { from, pipe, last, toArray, toPromise, Subject } from "../../src/index.js";

describe("last", () => {
  it("should get the last element of stream", async () => {
    const input = [1, 2, 3, 4];
    
    const result = await toPromise(pipe(
      from(input),
      last()
    ));
    
    expect(result).to.equal(4);
  });

  it("should work with single element", async () => {
    const input = [42];
    
    const result = await toPromise(pipe(
      from(input),
      last()
    ));
    
    expect(result).to.equal(42);
  });

  it("should handle empty stream", async () => {
    const input = [];
    
    const result = await toArray(pipe(
      from(input),
      last()
    ));
    
    // Empty stream results in empty output
    expect(result).to.deep.equal([]);
  });

  it("should get last element matching predicate", async () => {
    const input = [1, 2, 3, 4, 5, 6];
    
    const result = await toArray(pipe(
      from(input),
      last(x => x % 2 === 0) // last even number
    ));
    
    expect(result).to.deep.equal([6]);
  });

  it("should handle no elements matching predicate", async () => {
    const input = [1, 3, 5, 7];
    
    const result = await toArray(pipe(
      from(input),
      last(x => x % 2 === 0) // no even numbers
    ));
    
    // No matching elements results in empty output
    expect(result).to.deep.equal([]);
  });

  it("should work with complex predicate", async () => {
    const input = [1, 2, 3, 4, 5];
    
    const result = await toPromise(pipe(
      from(input),
      last(x => x > 3)
    ));
    
    expect(result).to.equal(5);
  });

  it("should handle predicate errors", async () => {
    const input = [1, 2, 3, 4];
    
    try {
      await toPromise(pipe(
        from(input),
        last(x => {
          if (x === 3) throw new Error("Predicate error");
          return x > 2;
        })
      ));
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.equal("Predicate error");
    }
  });

  it("should work with different types", async () => {
    const input = ['apple', 'banana', 'cherry', 'date'];
    
    const result = await toPromise(pipe(
      from(input),
      last(s => s.length > 5)
    ));
    
    expect(result).to.equal('cherry');
  });

  it("should handle async streams", async () => {
    const subject = new Subject<number>();
    
    const resultPromise = toPromise(pipe(
      subject.readable,
      last()
    ));
    
    subject.next(1);
    subject.next(2);
    subject.next(3);
    subject.complete();
    
    const result = await resultPromise;
    expect(result).to.equal(3);
  });

  it("should handle stream errors", async () => {
    const subject = new Subject<number>();
    
    const resultPromise = toPromise(pipe(
      subject.readable,
      last()
    ));
    
    subject.next(1);
    subject.error(new Error("Stream error"));
    
    try {
      await resultPromise;
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.equal("Stream error");
    }
  });

  it("should handle cancellation", async () => {
    const stream = pipe(
      from([1, 2, 3, 4, 5]),
      last()
    );

    const reader = stream.getReader();
    
    // Cancel the stream
    await reader.cancel('User cancelled');
    // If we get here, cancellation was handled
    expect(true).to.be.true;
  });

  it("should handle cleanup errors during cancellation", async () => {
    // Create a stream that throws on cancel
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.enqueue(2);
        controller.enqueue(3);
        // Don't close to force cancellation
      },
      cancel() {
        throw new Error('Cancel error');
      }
    });

    const stream = pipe(mockStream, last());
    const reader = stream.getReader();
    
    // Should handle cancel errors gracefully
    await reader.cancel('test cancel');
    // If we get here, it handled the cleanup error
    expect(true).to.be.true;
  });

  it("should handle cleanup errors during error", async () => {
    // Create a stream that throws on both read and cancel
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.error(new Error('Stream error'));
      },
      cancel() {
        throw new Error('Cancel error');
      }
    });

    try {
      await toArray(pipe(errorStream, last()));
      expect.fail('Expected stream to throw error');
    } catch (err) {
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal('Stream error');
    }
  });

  it("should work with custom highWaterMark", async () => {
    const result = await toArray(
      pipe(
        from([1, 2, 3, 4, 5]),
        (src) => last()(src, { highWaterMark: 1 })
      )
    );

    expect(result).to.deep.equal([5]);
  });

  it("should handle multiple matching values", async () => {
    const input = [1, 2, 4, 6, 8, 10];
    
    const result = await toArray(pipe(
      from(input),
      last(x => x % 2 === 0) // last even number
    ));
    
    expect(result).to.deep.equal([10]); // Should get only the last matching value
  });

  it("should handle default selector", async () => {
    const input = [1, 2, 3, 4, 5];
    
    const result = await toArray(pipe(
      from(input),
      last() // Default selector returns true for all
    ));
    
    expect(result).to.deep.equal([5]);
  });

  it("should handle boolean values", async () => {
    const input = [true, false, true, false];
    
    const result = await toArray(pipe(
      from(input),
      last(x => x === true)
    ));
    
    expect(result).to.deep.equal([true]);
  });

  it("should handle null and undefined values", async () => {
    const input = [1, null, 2, undefined, 3];
    
    const result = await toArray(pipe(
      from(input),
      last(x => x != null)
    ));
    
    expect(result).to.deep.equal([3]);
  });

  it("should handle stream with only non-matching values", async () => {
    const input = [1, 3, 5, 7, 9];
    
    const result = await toArray(pipe(
      from(input),
      last(x => x % 2 === 0) // no even numbers
    ));
    
    expect(result).to.deep.equal([]);
  });

  it("should handle early reader cancellation scenario", async () => {
    const stream = pipe(
      from([1, 2, 3]),
      last()
    );

    // This tests the reader cancellation path during processing
    const reader = stream.getReader();
    reader.cancel('early cancel');
    
    // Just ensure this doesn't throw
    expect(true).to.be.true;
  });
});
