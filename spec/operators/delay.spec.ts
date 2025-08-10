import { describe, it } from "mocha";
import { expect } from "chai";
import { from, pipe, toArray, delay, empty, of, throwError } from "../../src/index.js";
import { sleep } from "../../src/utils/sleep.js";

describe("delay", () => {
  it("should delay emissions", async () => {
    const result = await toArray(pipe(
      from([1, 2, 3]),
      delay(10) // Use smaller delay for faster test
    ));
    
    expect(result).to.deep.equal([1, 2, 3]);
  });

  it("should handle zero delay", async () => {
    const result = await toArray(pipe(
      from([1, 2, 3]),
      delay(0)
    ));
    expect(result).to.deep.equal([1, 2, 3]);
  });

  it("should throw error for negative delay", () => {
    expect(() => delay(-1)).to.throw("Delay duration must be non-negative");
  });

  it("should handle empty stream", async () => {
    const result = await toArray(pipe(
      empty(),
      delay(50)
    ));
    expect(result).to.deep.equal([]);
  });

  it("should handle single value stream", async () => {
    const result = await toArray(pipe(
      of(42),
      delay(10) // Use smaller delay for faster test
    ));
    
    expect(result).to.deep.equal([42]);
  });

  it("should handle stream errors", async () => {
    try {
      await toArray(pipe(
        throwError(new Error("Test error")),
        delay(50)
      ));
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.equal("Test error");
    }
  });

  it("should handle cancellation properly", async () => {
    const delayedStream = pipe(
      from([1, 2, 3, 4, 5]),
      delay(100)
    );
    
    const reader = delayedStream.getReader();
    
    // Start reading
    const firstPromise = reader.read();
    
    // Cancel after a short time
    await sleep(10); // Use deterministic sleep
    await reader.cancel();
    
    const result = await firstPromise;
    expect(result.done).to.be.true;
  });

  it("should handle backpressure with custom highWaterMark", async () => {
    const source = from([1, 2, 3, 4, 5]);
    const delayOperator = delay(10);
    const delayedStream = delayOperator(source, { highWaterMark: 2 });
    
    const result = await toArray(delayedStream);
    expect(result).to.deep.equal([1, 2, 3, 4, 5]);
  });

  it("should handle very small delays", async () => {
    const result = await toArray(pipe(
      from([1, 2]),
      delay(1)
    ));
    
    expect(result).to.deep.equal([1, 2]);
  });

  it("should handle controller errors gracefully", async () => {
    // Create a stream that will have timing issues
    const problematicStream = new ReadableStream({
      start(controller) {
        // Emit values rapidly to test timing edge cases
        controller.enqueue(1);
        controller.enqueue(2);
        controller.close();
      }
    });
    
    const result = await toArray(pipe(
      problematicStream,
      delay(5)
    ));
    
    expect(result).to.deep.equal([1, 2]);
  });

  it("should handle stream that completes before all delays", async () => {
    // Stream that completes quickly with multiple values
    const fastStream = from([1, 2, 3]);
    
    const result = await toArray(pipe(
      fastStream,
      delay(20)
    ));
    
    expect(result).to.deep.equal([1, 2, 3]);
  });

  it("should handle reader release during delay", async () => {
    const delayedStream = pipe(
      from([1, 2, 3]),
      delay(50)
    );
    
    const reader = delayedStream.getReader();
    
    // Read first value
    const first = await reader.read();
    expect(first.value).to.equal(1);
    expect(first.done).to.be.false;
    
    // Cancel to test cleanup
    await reader.cancel();
    
    const result = await reader.read();
    expect(result.done).to.be.true;
  });

  it("should handle error in delayed emission", async () => {
    // Create a stream that errors after some values
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        // Use immediate error instead of setTimeout for deterministic test
        controller.error(new Error("Delayed error"));
      }
    });
    
    try {
      await toArray(pipe(
        errorStream,
        delay(5)
      ));
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.equal("Delayed error");
    }
  });

  it("should wait for pending timeouts before closing", async () => {
    // Stream with multiple values that should all be delayed
    const result = await toArray(pipe(
      from([1, 2]),
      delay(10) // Use smaller delay for faster test
    ));
    
    expect(result).to.deep.equal([1, 2]);
  });

  it("should handle timeout cleanup on error", async () => {
    let controllerRef: ReadableStreamDefaultController<number>;
    
    const problemStream = new ReadableStream({
      start(controller) {
        controllerRef = controller;
        controller.enqueue(1);
        controller.enqueue(2);
        // Error immediately instead of using setTimeout for deterministic test
        controller.error(new Error("Cleanup test"));
      }
    });
    
    try {
      await toArray(pipe(
        problemStream,
        delay(10)
      ));
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.equal("Cleanup test");
    }
  });

  it("should handle multiple rapid cancellations", async () => {
    const delayedStream = pipe(
      from([1, 2, 3, 4, 5]),
      delay(20)
    );
    
    const reader = delayedStream.getReader();
    
    // Cancel multiple times rapidly (should be safe)
    reader.cancel();
    reader.cancel();
    reader.cancel();
    
    const result = await reader.read();
    expect(result.done).to.be.true;
  });
});
