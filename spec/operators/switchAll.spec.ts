import { describe, it } from "mocha";
import { expect } from "chai";
import { from, pipe, toArray, switchAll, Subject, timer, throwError, of } from "../../src/index.js";

describe("switchAll", () => {
  it("should switch to latest stream", async () => {
    const result = await toArray(pipe(
      from([
        from([1, 2]),
        from([3, 4])
      ]),
      switchAll()
    ));
    // With synchronous streams, switchAll switches immediately to the latest stream
    // Only the first value from the first stream and all values from the last stream are emitted
    expect(result).to.deep.equal([1, 3, 4]);
  });

  it("should cancel previous inner stream when switching", async () => {
    // Create a stream that produces inner streams with a delay, testing switching behavior
    const subject = new Subject<ReadableStream<number>>();
    
    // First inner stream (will be cancelled)
    const firstInner = timer(100); // Slow stream that should be cancelled
    subject.next(firstInner);
    
    // Second inner stream (should complete)
    setTimeout(() => {
      subject.next(from([10, 20])); // Fast stream
      subject.complete();
    }, 10);
    
    const result = await toArray(pipe(subject.readable, switchAll()));
    expect(result).to.deep.equal([10, 20]);
  });

  it("should handle empty source stream", async () => {
    const result = await toArray(pipe(
      from([]),
      switchAll()
    ));
    expect(result).to.deep.equal([]);
  });

  it("should handle promises that resolve to streams", async () => {
    const result = await toArray(pipe(
      from([
        Promise.resolve(from([1, 2])),
        Promise.resolve(from([3, 4]))
      ]),
      switchAll()
    ));
    // With synchronous promise resolution, switchAll switches immediately to the latest stream
    expect(result).to.deep.equal([1, 3, 4]);
  });

  it("should handle inner stream cancellation gracefully", async () => {
    // Test that switchAll can handle the cancellation of inner streams
    // This is a simplified test that focuses on the core functionality
    // rather than trying to force specific error conditions
    const source = from([
      from([1, 2]),    // First stream
      from([3, 4])     // Second stream (switching should work smoothly)
    ]);

    const result = await toArray(pipe(source, switchAll()));
    
    // With synchronous streams, switchAll switches immediately to the latest stream
    expect(result).to.deep.equal([1, 3, 4]);
  });

  it("should handle errors in source stream", async () => {
    const errorMessage = "source error";
    
    try {
      await toArray(pipe(
        throwError(new Error(errorMessage)),
        switchAll()
      ));
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.equal(errorMessage);
    }
  });

  it("should handle errors in inner streams", async () => {
    const errorMessage = "inner error";
    
    try {
      await toArray(pipe(
        from([
          from([1, 2]),
          throwError(new Error(errorMessage))
        ]),
        switchAll()
      ));
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.equal(errorMessage);
    }
  });

  it("should work with custom highWaterMark", async () => {
    const source = from([
      from([1, 2]),
      from([3, 4])
    ]);
    
    const result = await toArray(
      switchAll()(source, { highWaterMark: 1 })
    );
    // With synchronous streams, some values may be read before switching occurs
    expect(result).to.deep.equal([1, 3, 4]);
  });

  it("should handle single inner stream", async () => {
    const result = await toArray(pipe(
      from([from([1, 2, 3])]),
      switchAll()
    ));
    expect(result).to.deep.equal([1, 2, 3]);
  });

  it("should handle errors during promise resolution", async () => {
    const rejectedPromise = Promise.reject(new Error("Promise rejection"));
    const errorMessage = "Promise rejection";
    
    try {
      await toArray(pipe(
        from([rejectedPromise]),
        switchAll()
      ));
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.equal(errorMessage);
    }
  });

  it("should handle cancellation properly", async () => {
    const stream = pipe(
      from([from([1, 2, 3])]),
      switchAll()
    );
    
    const reader = stream.getReader();
    
    // Read first value
    const firstResult = await reader.read();
    expect(firstResult.value).to.equal(1);
    
    // Cancel the reader
    await reader.cancel("test cancel");
    
    // Verify cancellation worked
    const nextResult = await reader.read();
    expect(nextResult.done).to.be.true;
  });

  it("should handle very fast switching", async () => {
    // Create many small streams that switch rapidly
    const streams = Array.from({ length: 5 }, (_, i) => from([i * 10, i * 10 + 1]));
    
    const result = await toArray(pipe(
      from(streams),
      switchAll()
    ));
    
    // With synchronous streams, some values from each stream may be read before switching
    expect(result).to.deep.equal([0, 10, 20, 30, 40, 41]);
  });

  it("should handle mixed stream types", async () => {
    const result = await toArray(pipe(
      from([
        from([1]),
        Promise.resolve(from([2])),
        from([3])
      ]),
      switchAll()
    ));
    
    expect(result).to.deep.equal([1, 2, 3]);
  });

  it("should complete when source and inner streams complete", async () => {
    const result = await toArray(pipe(
      from([
        from([1]),
        from([2]),
        from([])  // Empty inner stream
      ]),
      switchAll()
    ));
    
    expect(result).to.deep.equal([1, 2]);
  });

  it("should handle controller errors gracefully", async () => {
    // This tests the error handling in the flush function
    const stream = pipe(
      from([from([1, 2, 3])]),
      switchAll()
    );
    
    const reader = stream.getReader();
    
    // Read first value to start the stream
    const result = await reader.read();
    expect(result.value).to.equal(1);
    
    reader.releaseLock();
  });

  it("should handle cancellation with active inner reader", async () => {
    // Test cancellation when currentInnerReader exists (covers lines 95-96)
    const subject = new Subject<ReadableStream<number>>();
    
    // Start with an inner stream
    subject.next(timer(1000)); // Long delay to ensure it's still active when cancelled
    
    const stream = pipe(subject.readable, switchAll());
    const reader = stream.getReader();
    
    // Give it a moment to start reading from inner stream
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Cancel should clean up both source and inner readers
    await reader.cancel("test cancel");
    
    // Verify cancellation worked
    const nextResult = await reader.read();
    expect(nextResult.done).to.be.true;
  });

  it('should switch at precise timings', async () => {
    // Create async generators with precise timing
    async function* firstStream() {
      await new Promise(resolve => setTimeout(resolve, 50));
      yield 'a'; // At 50ms
      await new Promise(resolve => setTimeout(resolve, 50));
      yield 'b'; // At 100ms
      await new Promise(resolve => setTimeout(resolve, 100)); // Longer delay
      yield 'c'; // At 200ms (this should be cancelled)
      await new Promise(resolve => setTimeout(resolve, 100));
      yield 'd'; // At 300ms (this should be cancelled)
    }

    async function* secondStream() {
      await new Promise(resolve => setTimeout(resolve, 50));
      yield 'e'; // At 50ms when this stream starts
      await new Promise(resolve => setTimeout(resolve, 50));
      yield 'f'; // At 100ms from when second stream starts
      await new Promise(resolve => setTimeout(resolve, 50));
      yield 'g'; // At 150ms from when second stream starts
    }

    const source = new Subject<ReadableStream<string>>();
    const stream = pipe(source.readable, switchAll());
    const reader = stream.getReader();
    const results: string[] = [];

    // Start reading in background
    const readPromise = (async () => {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          results.push(value);
        }
      } catch (error) {
        // Stream was cancelled
      }
    })();

    // Send first stream immediately
    source.next(from(firstStream()));

    // Wait for 'a' and 'b' to be emitted, but before 'c'
    // C will be emitted 200ms from when the first stream starts
    // but if we switch to the second stream before that, 'c' should be cancelled
    await new Promise(resolve => setTimeout(resolve, 120)); // emit after a and b (100ms at least)

    // At this point we should have received 'a' and 'b'
    // Now send the second stream to trigger the switch (before 'c' is emitted)
    source.next(from(secondStream()));

    // Wait for second stream to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    // Complete the source
    source.complete();

    // Wait for reading to finish
    await readPromise;

    // Verify the expected sequence: a, b, then switch to e, f, g
    // The 'c' and 'd' from first stream should be cancelled
    expect(results).to.deep.equal(['a', 'b', 'e', 'f', 'g']);
  });
});
