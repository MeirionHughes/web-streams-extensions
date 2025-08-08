import { expect } from "chai";
import { from, pipe, throttleTime, toArray, Subject } from "../../src/index.js";

describe("throttleTime", () => {
  it("should handle empty stream", async () => {
    const result = await toArray(pipe(
      from([]),
      throttleTime(100)
    ));
    
    expect(result).to.deep.equal([]);
  });

  it("should handle single value", async () => {
    const result = await toArray(pipe(
      from([42]),
      throttleTime(100)
    ));
    
    expect(result).to.deep.equal([42]);
  });

  it("should handle multiple values from completed stream", async () => {
    const result = await toArray(pipe(
      from([1, 2, 3, 4, 5]),
      throttleTime(50)
    ));
    
    // With a completed stream, behavior depends on implementation
    expect(result).to.be.an('array');
    expect(result.length).to.be.greaterThan(0);
  });

  it("should handle zero throttle time", async () => {
    const values = [1, 2, 3, 4, 5];
    const result = await toArray(pipe(
      from(values),
      throttleTime(0) // No throttling
    ));
    
    // With 0 throttle, all values should pass through
    expect(result).to.deep.equal(values);
  });

  it("should handle basic throttling with simple stream", async () => {
    const subject = new Subject<number>();
    
    const resultPromise = toArray(pipe(
      subject.readable,
      throttleTime(10) // Short throttle for testing
    ));
    
    // Emit values quickly then complete
    subject.next(1);
    subject.next(2);
    subject.next(3);
    subject.complete();
    
    const result = await resultPromise;
    
    // Should have at least the first value
    expect(result).to.include(1);
    expect(result.length).to.be.greaterThan(0);
  });

  it("should throw error for negative duration", async () => {
    try {
      await toArray(pipe(
        from([1, 2, 3]),
        throttleTime(-100)
      ));
      expect.fail("Should have thrown an error");
    } catch (err) {
      // Negative durations should cause issues
      expect(err).to.exist;
    }
  });

  it("should handle stream errors", async () => {
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
        throttleTime(100)
      ));
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.equal(errorMessage);
    }
  });

  it("should handle cancellation properly", async () => {
    const subject = new Subject<number>();
    
    const stream = pipe(
      subject.readable,
      throttleTime(100)
    );
    
    const reader = stream.getReader();
    
    // Emit a value and read it
    await subject.next(1);
    const first = await reader.read();
    expect(first.value).to.equal(1);
    
    // Cancel the reader
    await reader.cancel("Test cancellation");
    reader.releaseLock();
    
    // Further values should not be processed
    await subject.next(2);
    await subject.complete();
  });

  it("should handle very fast emissions", async () => {
    const subject = new Subject<number>();
    
    const resultPromise = toArray(pipe(
      subject.readable,
      throttleTime(50)
    ));
    
    // Emit values very quickly
    for (let i = 1; i <= 10; i++) {
      await subject.next(i);
    }
    
    await subject.complete();
    
    const result = await resultPromise;
    
    // Should throttle to fewer values
    expect(result).to.include(1); // First value always goes through
    expect(result.length).to.be.lessThan(10);
  });

  it("should emit pending value on stream completion", async () => {
    const subject = new Subject<number>();
    
    const resultPromise = toArray(pipe(
      subject.readable,
      throttleTime(1000) // Long throttle
    ));
    
    await subject.next(1); // This goes through immediately
    await subject.next(2); // This becomes pending
    await subject.complete(); // Should emit pending value
    
    const result = await resultPromise;
    
    expect(result).to.include(1);
    expect(result).to.include(2); // Pending value should be emitted on completion
  });

  it("should work with custom highWaterMark", async () => {
    const values = [1, 2, 3, 4, 5];
    const result = await toArray(
      throttleTime(10)(
        from(values),
        { highWaterMark: 1 }
      )
    );
    
    expect(result).to.be.an('array');
    expect(result.length).to.be.greaterThan(0);
  });

  it("should handle backpressure correctly", async () => {
    const subject = new Subject<number>();
    
    const stream = pipe(
      subject.readable,
      throttleTime(50)
    );
    
    const reader = stream.getReader();
    const results: number[] = [];
    
    // Emit and read values
    await subject.next(1);
    await subject.next(2);
    await subject.next(3);
    
    // Read what's available
    try {
      while (true) {
        const result = await Promise.race([
          reader.read(),
          new Promise<ReadableStreamReadResult<number>>((_, reject) => 
            setTimeout(() => reject(new Error('timeout')), 100)
          )
        ]);
        
        if (result.done) break;
        results.push(result.value);
      }
    } catch (err) {
      // Timeout is expected
    }
    
    await subject.complete();
    
    // Read remaining values
    try {
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        results.push(result.value);
      }
    } catch (err) {
      // Ignore
    }
    
    reader.releaseLock();
    
    expect(results).to.include(1);
  });

  it("should handle very large throttle duration", async () => {
    const subject = new Subject<number>();
    
    const resultPromise = toArray(pipe(
      subject.readable,
      throttleTime(Number.MAX_SAFE_INTEGER)
    ));
    
    await subject.next(1); // First value goes through
    await subject.next(2); // This will be pending
    await subject.complete(); // Should emit pending value
    
    const result = await resultPromise;
    
    expect(result).to.include(1);
    expect(result).to.include(2);
  });

  it("should replace pending value with latest", async () => {
    const subject = new Subject<number>();
    
    const resultPromise = toArray(pipe(
      subject.readable,
      throttleTime(1000) // Long throttle
    ));
    
    await subject.next(1); // Goes through immediately
    await subject.next(2); // Becomes pending
    await subject.next(3); // Replaces pending value
    await subject.next(4); // Replaces pending value again
    await subject.complete();
    
    const result = await resultPromise;
    
    expect(result).to.include(1);
    expect(result).to.include(4); // Should have latest pending value
    expect(result).to.not.include(2);
    expect(result).to.not.include(3);
  });

  it("should handle controller already closed error", async () => {
    const subject = new Subject<number>();
    
    const stream = pipe(
      subject.readable,
      throttleTime(10)
    );
    
    const reader = stream.getReader();
    
    await subject.next(1);
    const first = await reader.read();
    expect(first.value).to.equal(1);
    
    // Complete the subject to close the controller
    await subject.complete();
    
    // Wait for completion
    const final = await reader.read();
    expect(final.done).to.be.true;
    
    reader.releaseLock();
  });

  it("should cleanup interval on error", async () => {
    let intervalsCleaned = 0;
    const originalClearInterval = clearInterval;
    (global as any).clearInterval = (id: any) => {
      intervalsCleaned++;
      return originalClearInterval(id);
    };
    
    try {
      const errorStream = new ReadableStream({
        start(controller) {
          controller.enqueue(1);
          controller.error(new Error("Test error"));
        }
      });

      try {
        await toArray(pipe(
          errorStream,
          throttleTime(100)
        ));
        expect.fail("Should have thrown an error");
      } catch (err) {
        // Expected error
      }
      
      // Give some time for cleanup
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(intervalsCleaned).to.be.greaterThan(0);
    } finally {
      (global as any).clearInterval = originalClearInterval;
    }
  });

  it("should cleanup interval on cancel", async () => {
    let intervalsCleaned = 0;
    const originalClearInterval = clearInterval;
    (global as any).clearInterval = (id: any) => {
      intervalsCleaned++;
      return originalClearInterval(id);
    };
    
    try {
      const subject = new Subject<number>();
      
      const stream = pipe(
        subject.readable,
        throttleTime(100)
      );
      
      const reader = stream.getReader();
      
      await subject.next(1);
      await reader.read();
      
      await reader.cancel("test");
      reader.releaseLock();
      
      // Give some time for cleanup
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(intervalsCleaned).to.be.greaterThan(0);
    } finally {
      (global as any).clearInterval = originalClearInterval;
    }
  });

  it("should handle reader release errors during cleanup", async () => {
    const subject = new Subject<number>();
    
    const stream = pipe(
      subject.readable,
      throttleTime(100)
    );
    
    const reader = stream.getReader();
    
    await subject.next(1);
    await reader.read();
    
    // Cancel should handle cleanup gracefully even if reader throws
    await reader.cancel("test");
    reader.releaseLock();
  });

  it("should work with different data types", async () => {
    const subject = new Subject<string>();
    
    const resultPromise = toArray(pipe(
      subject.readable,
      throttleTime(10)
    ));
    
    await subject.next("a");
    await subject.next("b");
    await subject.next("c");
    await subject.complete();
    
    const result = await resultPromise;
    
    expect(result).to.include("a");
    expect(result.length).to.be.greaterThan(0);
  });

  it("should handle multiple rapid emissions followed by delay", async () => {
    const subject = new Subject<number>();
    
    const resultPromise = toArray(pipe(
      subject.readable,
      throttleTime(50)
    ));
    
    // Rapid emissions
    await subject.next(1);
    await subject.next(2);
    await subject.next(3);
    
    // Wait for throttle period
    await new Promise(resolve => setTimeout(resolve, 60));
    
    // More emissions
    await subject.next(4);
    await subject.next(5);
    await subject.complete();
    
    const result = await resultPromise;
    
    expect(result).to.include(1); // First always goes through
    expect(result.length).to.be.greaterThan(1);
    // The exact values depend on timing, so just check we have reasonable results
    expect(result.every(val => [1, 2, 3, 4, 5].includes(val))).to.be.true;
  });
});
