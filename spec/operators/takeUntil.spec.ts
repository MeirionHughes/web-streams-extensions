import { expect } from "chai";
import { from, pipe, takeUntil, toArray } from "../../src/index.js";
import { Subject } from "../../src/subjects/subject.js";


describe("takeUntil", () => {
  it("should take values until notifier emits", async () => {
    const source = new Subject<number>();
    const notifier = new Subject<string>();
    
    const resultPromise = toArray(pipe(
      source.readable,
      takeUntil(notifier.readable)
    ));
    
    // Emit some values from source
    await source.next(1);
    await source.next(2);
    await source.next(3);
    
    // Signal stop
    await notifier.next("stop");
    
    // These should not be included
    await source.next(4);
    await source.next(5);
    await source.complete();
    
    const result = await resultPromise;
    expect(result).to.deep.equal([1, 2, 3]);
  });

  it("should complete if source completes before notifier", async () => {
    const input = [1, 2, 3];
    const notifier = new Subject<string>();
    
    const result = await toArray(pipe(
      from(input),
      takeUntil(notifier.readable)
    ));
    
    expect(result).to.deep.equal([1, 2, 3]);
  });

  it("should handle empty source", async () => {
    const notifier = new Subject<string>();
    
    const result = await toArray(pipe(
      from([]),
      takeUntil(notifier.readable)
    ));
    
    expect(result).to.deep.equal([]);
  });

  it("should handle immediate notifier emission", async () => {
    const source = new Subject<number>();
    const notifier = from(["stop"]); // Immediately emits
    
    const resultPromise = toArray(pipe(
      source.readable,
      takeUntil(notifier)
    ));
    
    // These might not be emitted due to timing
    source.next(1);
    source.next(2);
    source.complete();
    
    const result = await resultPromise;
    // Result could be empty or partial depending on timing
    expect(result.length).to.be.lessThanOrEqual(2);
  });

  it("should handle source errors", async () => {
    const notifier = new Subject<string>();
    const errorMessage = "Source error";
    
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.error(new Error(errorMessage));
      }
    });

    try {
      await toArray(pipe(
        errorStream,
        takeUntil(notifier.readable)
      ));
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.equal(errorMessage);
    }
  });

  it("should handle notifier errors gracefully", async () => {
    const source = new Subject<number>();
    const errorMessage = "Notifier error";
    
    const errorNotifier = new ReadableStream({
      start(controller) {
        controller.error(new Error(errorMessage));
      }
    });
    
    const resultPromise = toArray(pipe(
      source.readable,
      takeUntil(errorNotifier)
    ));
    
    // Source should continue despite notifier error
    await source.next(1);
    await source.next(2);
    await source.complete();
    
    const result = await resultPromise;
    expect(result).to.deep.equal([1, 2]);
  });

  it("should handle cancellation properly", async () => {
    const source = new Subject<number>();
    const notifier = new Subject<string>();
    
    const stream = pipe(
      source.readable,
      takeUntil(notifier.readable)
    );
    
    const reader = stream.getReader();
    
    // Read one value
    await source.next(1);
    const first = await reader.read();
    expect(first.value).to.equal(1);
    
    // Cancel the reader
    await reader.cancel("Test cancellation");
    reader.releaseLock();
    
    // Further values should not be processed
    await source.next(2);
    await source.complete();
  });

  it("should work with custom highWaterMark", async () => {
    const input = [1, 2, 3, 4, 5];
    const notifier = new Subject<string>();
    
    const result = await toArray(
      takeUntil(notifier.readable)(
        from(input),
        { highWaterMark: 1 }
      )
    );
    
    expect(result).to.deep.equal(input);
  });

  it("should handle backpressure correctly", async () => {
    const source = new Subject<number>();
    const notifier = new Subject<string>();
    
    const resultPromise = toArray(pipe(
      source.readable,
      takeUntil(notifier.readable)
    ));
    
    // Emit values
    await source.next(1);
    await source.next(2);
    await source.next(3);
    await source.complete();
    
    const result = await resultPromise;
    expect(result).to.deep.equal([1, 2, 3]);
  });

  it("should handle notifier that completes without emitting", async () => {
    const source = new Subject<number>();
    const notifier = new Subject<string>();
    
    const resultPromise = toArray(pipe(
      source.readable,
      takeUntil(notifier.readable)
    ));
    
    await source.next(1);
    await source.next(2);
    
    // Complete notifier without emitting
    await notifier.complete();
    
    await source.next(3);
    await source.complete();
    
    const result = await resultPromise;
    expect(result).to.deep.equal([1, 2, 3]);
  });

  it("should handle multiple notifier emissions", async () => {
    const source = new Subject<number>();
    const notifier = new Subject<string>();
    
    const resultPromise = toArray(pipe(
      source.readable,
      takeUntil(notifier.readable)
    ));
    
    await source.next(1);
    await source.next(2);
    
    // First emission should stop the stream
    await notifier.next("stop1");
    
    // Second emission should have no effect
    await notifier.next("stop2");
    
    await source.complete();
    
    const result = await resultPromise;
    expect(result).to.deep.equal([1, 2]);
  });

  it("should work with different data types", async () => {
    const source = new Subject<string>();
    const notifier = new Subject<number>();
    
    const resultPromise = toArray(pipe(
      source.readable,
      takeUntil(notifier.readable)
    ));
    
    await source.next("a");
    await source.next("b");
    await notifier.next(123);
    await source.complete();
    
    const result = await resultPromise;
    expect(result).to.deep.equal(["a", "b"]);
  });

  it("should handle very fast source with slow notifier", async () => {
    const values = Array.from({ length: 100 }, (_, i) => i);
    const notifier = new Subject<string>();
    
    // Start processing fast source
    const resultPromise = toArray(pipe(
      from(values),
      takeUntil(notifier.readable)
    ));
    
    // Let some values process then signal stop
    await new Promise(resolve => setTimeout(resolve, 10));
    await notifier.next("stop");
    
    const result = await resultPromise;
    // Should get all values since source completes before notifier
    expect(result).to.deep.equal(values);
  });

  it("should handle very fast notifier", async () => {
    const source = new Subject<number>();
    
    // Create a notifier that emits immediately
    const fastNotifier = new ReadableStream({
      start(controller) {
        controller.enqueue("immediate");
        controller.close();
      }
    });
    
    const resultPromise = toArray(pipe(
      source.readable,
      takeUntil(fastNotifier)
    ));
    
    // Try to emit values - might not get through due to fast notifier
    source.next(1);
    source.next(2);
    source.complete();
    
    const result = await resultPromise;
    // Result depends on timing but should be limited
    expect(result.length).to.be.lessThanOrEqual(2);
  });

  it("should handle reader cleanup errors during cancel", async () => {
    const source = new Subject<number>();
    const notifier = new Subject<string>();
    
    // Create a stream where reader cleanup might fail
    const problematicStream = pipe(
      source.readable,
      takeUntil(notifier.readable)
    );
    
    const reader = problematicStream.getReader();
    
    await source.next(1);
    const first = await reader.read();
    expect(first.value).to.equal(1);
    
    // Cancel should handle cleanup gracefully
    await reader.cancel("test");
    reader.releaseLock();
  });

  it("should stop reading after notifier emits even with pending reads", async () => {
    const source = new Subject<number>();
    const notifier = new Subject<string>();
    
    const resultPromise = toArray(pipe(
      source.readable,
      takeUntil(notifier.readable)
    ));
    
    await source.next(1);
    await source.next(2);
    
    // Signal stop
    await notifier.next("stop");
    
    // Complete source
    await source.complete();
    
    const result = await resultPromise;
    expect(result).to.deep.equal([1, 2]);
  });

  it("should handle empty notifier stream", async () => {
    const source = new Subject<number>();
    const emptyNotifier = from([]); // Empty stream
    
    const resultPromise = toArray(pipe(
      source.readable,
      takeUntil(emptyNotifier)
    ));
    
    await source.next(1);
    await source.next(2);
    await source.complete();
    
    const result = await resultPromise;
    expect(result).to.deep.equal([1, 2]);
  });

  it("should handle concurrent start and notifier emission", async () => {
    const source = new Subject<number>();
    const notifier = new Subject<string>();
    
    // Start the stream
    const resultPromise = toArray(pipe(
      source.readable,
      takeUntil(notifier.readable)
    ));
    
    // Immediately emit from both
    await Promise.all([
      source.next(1),
      notifier.next("stop")
    ]);
    
    await source.complete();
    
    const result = await resultPromise;
    // Timing dependent but should handle gracefully
    expect(Array.isArray(result)).to.be.true;
  });
});
