import { expect } from "chai";
import { from, pipe, join, toArray, Subject } from "../src/index.js";

describe("join", () => {
  it("should join two streams with selector", async () => {
    const stream1 = from([1, 2, 3]);
    const stream2 = from(['a', 'b', 'c']);
    
    const result = await toArray(join(stream1, stream2, (a, b) => `${a}${b}`));
    
    expect(result).to.deep.equal(['1a', '2b', '3c']);
  });

  it("should handle streams of different lengths", async () => {
    const stream1 = from([1, 2, 3, 4, 5]);
    const stream2 = from(['a', 'b']);
    
    const result = await toArray(join(stream1, stream2, (a, b) => `${a}${b}`));
    
    expect(result).to.deep.equal(['1a', '2b']);
  });

  it("should handle empty first stream", async () => {
    const stream1 = from([]);
    const stream2 = from([1, 2]);
    
    const result = await toArray(join(stream1, stream2, (a, b) => [a, b]));
    
    expect(result).to.deep.equal([]);
  });

  it("should handle empty second stream", async () => {
    const stream1 = from([1, 2]);
    const stream2 = from([]);
    
    const result = await toArray(join(stream1, stream2, (a, b) => [a, b]));
    
    expect(result).to.deep.equal([]);
  });

  it("should combine different types", async () => {
    const stream1 = from([1, 2, 3]);
    const stream2 = from([true, false, true]);
    
    const result = await toArray(join(stream1, stream2, (num, bool) => ({ number: num, boolean: bool })));
    
    expect(result).to.deep.equal([
      { number: 1, boolean: true },
      { number: 2, boolean: false },
      { number: 3, boolean: true }
    ]);
  });

  it("should handle async streams", async () => {
    const subject1 = new Subject<number>();
    const subject2 = new Subject<string>();
    
    const resultPromise = toArray(join(subject1.readable, subject2.readable, (a, b) => `${a}-${b}`));
    
    subject1.next(1);
    subject2.next('x');
    subject1.next(2);
    subject2.next('y');
    subject1.complete();
    subject2.complete();
    
    const result = await resultPromise;
    
    expect(result).to.deep.equal(['1-x', '2-y']);
  });

  it("should handle errors from first stream", async () => {
    const subject1 = new Subject<number>();
    const subject2 = new Subject<string>();
    
    const resultPromise = toArray(join(subject1.readable, subject2.readable, (a, b) => `${a}-${b}`));
    
    subject1.error(new Error("Test error"));
    
    try {
      await resultPromise;
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.equal("Test error");
    }
  });

  it("should handle errors from second stream", async () => {
    const subject1 = new Subject<number>();
    const subject2 = new Subject<string>();
    
    const resultPromise = toArray(join(subject1.readable, subject2.readable, (a, b) => `${a}-${b}`));
    
    subject2.error(new Error("Test error"));
    
    try {
      await resultPromise;
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.equal("Test error");
    }
  });

  it("should handle selector function errors", async () => {
    const stream1 = from([1, 2, 3]);
    const stream2 = from(['a', 'b', 'c']);
    
    try {
      await toArray(join(stream1, stream2, (a, b) => {
        if (a === 2) throw new Error("Selector error");
        return `${a}${b}`;
      }));
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.equal("Selector error");
    }
  });

  it("should handle cancellation properly", async () => {
    let cancelledA = false;
    let cancelledB = false;
    
    const streamA = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.enqueue(2);
      },
      cancel(reason) {
        cancelledA = true;
      }
    });

    const streamB = new ReadableStream({
      start(controller) {
        controller.enqueue('a');
        controller.enqueue('b');
      },
      cancel(reason) {
        cancelledB = true;
      }
    });

    const joined = join(streamA, streamB, (a, b) => `${a}${b}`);
    const reader = joined.getReader();
    
    // Read one value
    const result1 = await reader.read();
    expect(result1.value).to.equal('1a');
    
    // Cancel the stream
    await reader.cancel("test cancellation");
    expect(cancelledA).to.be.true;
    expect(cancelledB).to.be.true;
  });

  it("should handle reader release errors during cancellation", async () => {
    const streamA = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
      },
      cancel() {
        throw new Error("Cancel error A");
      }
    });

    const streamB = new ReadableStream({
      start(controller) {
        controller.enqueue('a');
      },
      cancel() {
        throw new Error("Cancel error B");
      }
    });

    const joined = join(streamA, streamB, (a, b) => `${a}${b}`);
    const reader = joined.getReader();
    
    await reader.read();
    
    // This should handle the error gracefully
    try {
      await reader.cancel("test");
    } catch (err) {
      // The cancel errors should be handled internally
    }
  });

  it("should handle reader release errors during error cleanup", async () => {
    const streamA = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
      },
      cancel() {
        throw new Error("Cancel error A");
      }
    });

    const streamB = new ReadableStream({
      start(controller) {
        controller.enqueue('a');
      },
      cancel() {
        throw new Error("Cancel error B");
      }
    });

    try {
      await toArray(join(streamA, streamB, (a, b) => {
        throw new Error("Selector error");
      }));
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.equal("Selector error");
    }
  });

  it("should handle first stream done but second not done", async () => {
    const stream1 = from([1]);
    const stream2 = from(['a', 'b', 'c']);
    
    const result = await toArray(join(stream1, stream2, (a, b) => `${a}${b}`));
    
    expect(result).to.deep.equal(['1a']);
  });

  it("should handle second stream done but first not done", async () => {
    const stream1 = from([1, 2, 3]);
    const stream2 = from(['a']);
    
    const result = await toArray(join(stream1, stream2, (a, b) => `${a}${b}`));
    
    expect(result).to.deep.equal(['1a']);
  });
});
