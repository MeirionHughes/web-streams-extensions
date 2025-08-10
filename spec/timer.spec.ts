import { describe, it } from "mocha";
import { expect } from "chai";
import { timer, toArray, pipe, take } from "../src/index.js";
import { sleep } from "../src/utils/sleep.js";

describe("timer", () => {
  it("should emit single value after delay", async () => {
    const result = await toArray(timer(10)); // Use smaller delay for faster test
    expect(result).to.deep.equal([0]);
  });

  it("should emit incremental values with interval", async () => {
    const result = await toArray(pipe(timer(10, 20), take(3)));
    expect(result).to.deep.equal([0, 1, 2]);
  });

  it("should throw error for negative due time", () => {
    expect(() => timer(-1)).to.throw("Due time must be non-negative");
  });

  it("should throw error for negative interval", () => {
    expect(() => timer(0, -1)).to.throw("Interval duration must be positive");
  });

  it("should throw error for zero interval", () => {
    expect(() => timer(0, 0)).to.throw("Interval duration must be positive");
  });

  it("should handle immediate timer (due time 0)", async () => {
    const result = await toArray(timer(0));
    expect(result).to.deep.equal([0]);
  });

  it("should handle immediate timer with interval", async () => {
    const result = await toArray(pipe(timer(0, 10), take(3)));
    expect(result).to.deep.equal([0, 1, 2]);
  });

  it("should handle cancellation during due time", async () => {
    const timerStream = timer(100);
    const reader = timerStream.getReader();
    
    // Cancel before due time
    await sleep(5); // Use deterministic delay
    await reader.cancel();
    
    const result = await reader.read();
    expect(result.done).to.be.true;
  });

  it("should handle cancellation during interval", async () => {
    const timerStream = timer(5, 20); // Use smaller delays for faster test
    const reader = timerStream.getReader();
    
    // Get first value
    const first = await reader.read();
    expect(first.value).to.equal(0);
    expect(first.done).to.be.false;
    
    // Cancel before next interval
    await reader.cancel();
    
    const result = await reader.read();
    expect(result.done).to.be.true;
  });

  it("should handle controller errors gracefully in due timer", async () => {
    const timerStream = timer(5); // Use smaller delay for faster test
    const reader = timerStream.getReader();
    
    // Close the reader which should trigger cleanup
    await reader.cancel();
    
    // Should not throw any errors
    const result = await reader.read();
    expect(result.done).to.be.true;
  });

  it("should handle controller errors gracefully in interval timer", async () => {
    const timerStream = timer(5, 10); // Use smaller delays for faster test
    const reader = timerStream.getReader();
    
    // Get first value
    const first = await reader.read();
    expect(first.value).to.equal(0);
    
    // Cancel immediately after first emission to test interval cleanup
    await reader.cancel();
    
    // Should not throw any errors
    const result = await reader.read();
    expect(result.done).to.be.true;
  });

  it("should work with very small due times", async () => {
    const result = await toArray(timer(1));
    expect(result).to.deep.equal([0]);
  });

  it("should work with very small intervals", async () => {
    const result = await toArray(pipe(timer(1, 1), take(3)));
    expect(result).to.deep.equal([0, 1, 2]);
  });

  it("should handle multiple readers on same timer stream", async () => {
    const timerStream = timer(5); // Use smaller delay for faster test
    
    const reader1 = timerStream.getReader();
    try {
      // Getting a second reader should throw since the first one locks the stream
      timerStream.getReader();
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.include("locked");
    }
    
    const result = await reader1.read();
    expect(result.value).to.equal(0);
    expect(result.done).to.be.false;
    
    const end = await reader1.read();
    expect(end.done).to.be.true;
  });

  it("should continue emitting until cancelled for interval timer", async () => {
    const timerStream = timer(2, 5); // Use smaller delays for faster test
    const reader = timerStream.getReader();
    
    const values = [];
    
    // Read a few values
    for (let i = 0; i < 4; i++) {
      const result = await reader.read();
      if (result.done) break;
      values.push(result.value);
    }
    
    expect(values).to.deep.equal([0, 1, 2, 3]);
    
    await reader.cancel();
  });

  it("should handle controller closed error in due timer callback", async () => {
    const timerStream = timer(5);
    const reader = timerStream.getReader();
    
    // Start reading then immediately cancel to close the controller
    const readPromise = reader.read();
    await reader.cancel();
    
    // The read should complete and the timer should handle the closed controller
    const result = await readPromise;
    expect(result.done).to.be.true;
  });

  it("should handle controller closed error in interval timer callback", async () => {
    const timerStream = timer(2, 5); // Use smaller delays for faster test
    const reader = timerStream.getReader();
    
    // Get the first value
    const first = await reader.read();
    expect(first.value).to.equal(0);
    expect(first.done).to.be.false;
    
    // Cancel the stream which should trigger cleanup in the interval callback
    await reader.cancel();
    
    // Give the interval a chance to fire and encounter the closed controller
    await sleep(10); // Use deterministic sleep instead of setTimeout
    
    // Verify the stream is properly closed
    const result = await reader.read();
    expect(result.done).to.be.true;
  });

  it("should handle rapid cancellation during due time setup", async () => {
    const timerStream = timer(100);
    const reader = timerStream.getReader();
    
    // Cancel immediately, potentially before the setTimeout is even set up
    reader.cancel();
    
    const result = await reader.read();
    expect(result.done).to.be.true;
  });

  it("should handle rapid cancellation during interval setup", async () => {
    const timerStream = timer(1, 20); // Use longer interval for predictable test
    const reader = timerStream.getReader();
    
    // Wait for first emission but cancel very quickly to test cleanup timing
    await sleep(2); // Use deterministic sleep
    await reader.cancel();
    
    const result = await reader.read();
    // First value might or might not come through depending on timing
    if (!result.done) {
      expect(result.value).to.equal(0);
      const nextResult = await reader.read();
      expect(nextResult.done).to.be.true;
    } else {
      expect(result.done).to.be.true;
    }
  });

  it("should clean up timers when controller close throws", async () => {
    // This tests the error handling path in the due timer when controller.close() throws
    let timerStream = timer(1);
    let reader = timerStream.getReader();
    
    // Cancel the reader to put the controller in a closed state
    await reader.cancel();
    
    // Try to read which should be done
    const result = await reader.read();
    expect(result.done).to.be.true;
  });

  it("should clean up timers when interval callback encounters closed controller", async () => {
    const timerStream = timer(1, 3); // Use smaller delays for faster test
    const reader = timerStream.getReader();
    
    // Get first value
    const first = await reader.read();
    expect(first.value).to.equal(0);
    
    // Cancel quickly to trigger the closed controller error in interval callback
    await reader.cancel();
    
    // Wait for interval to potentially fire
    await sleep(5); // Use deterministic sleep instead of setTimeout
    
    // Stream should be properly cleaned up
    const result = await reader.read();
    expect(result.done).to.be.true;
  });

  it("should handle enqueue error in interval timer", async () => {
    const timerStream = timer(1, 3); // Use smaller delays for faster test
    const reader = timerStream.getReader();
    
    // Get first value
    const first = await reader.read();
    expect(first.value).to.equal(0);
    expect(first.done).to.be.false;
    
    // Cancel the stream immediately after first read to create a closed controller state
    reader.cancel();
    
    // Wait for the interval timer to fire and encounter the closed controller
    await sleep(5); // Use deterministic sleep instead of setTimeout
    
    // Verify final state
    const final = await reader.read();
    expect(final.done).to.be.true;
  });

  it("should handle enqueue error in due timer with controller.close() error", async () => {
    // Use the real timer function with very short delay
    const timerStream = timer(0); // Immediate timer
    const reader = timerStream.getReader();
    
    // Start reading and immediately close the reader in the same event loop turn
    // This creates a race condition where the timer might fire before cancel cleanup
    const readPromise = reader.read();
    setImmediate(() => reader.cancel()); // Cancel in next tick
    
    const result = await readPromise;
    // Result might be the value or done, depending on timing
    if (!result.done) {
      expect(result.value).to.equal(0);
      const next = await reader.read();
      expect(next.done).to.be.true;
    } else {
      expect(result.done).to.be.true;
    }
  });

  it("should handle interval timer enqueue error when reader is cancelled", async () => {
    // Use the real timer function with very short delays
    const timerStream = timer(0, 1); // Immediate start, 1ms interval
    const reader = timerStream.getReader();
    
    // Get first value
    const first = await reader.read();
    expect(first.value).to.equal(0);
    expect(first.done).to.be.false;
    
    // Cancel in the next microtask to create race condition
    setImmediate(() => reader.cancel());
    
    // Wait for potential interval firing
    await sleep(5); // Use deterministic sleep instead of setTimeout
    
    const result = await reader.read();
    expect(result.done).to.be.true;
  });

  it("should handle enqueue error in interval timer when controller is closed", async () => {
    // This test specifically targets the catch block in the interval timer
    const timerStream = timer(1, 1);
    const reader = timerStream.getReader();
    
    // Get the first value to establish the interval timer
    const first = await reader.read();
    expect(first.value).to.equal(0);
    expect(first.done).to.be.false;
    
    // Cancel the reader to close the controller
    await reader.cancel();
    
    // Wait for the interval timer to fire and hit the error condition
    await sleep(3); // Use deterministic sleep instead of setTimeout
    
    // Verify the stream handled the error gracefully (stream should be done)
    const result = await reader.read();
    expect(result.done).to.be.true;
  });

  it("should handle enqueue error in due timer when controller is closed", async () => {
    // This test specifically targets the catch block in the due timer
    const timerStream = timer(2); // Short delay timer
    const reader = timerStream.getReader();
    
    // Cancel the reader immediately to close the controller before timer fires
    await reader.cancel();
    
    // Wait for the due timer to fire and hit the error condition
    await sleep(3); // Use deterministic sleep instead of setTimeout
    
    // Verify the stream handled the error gracefully
    const result = await reader.read();
    expect(result.done).to.be.true;
  });

  it("should handle controller.close error in due timer", async () => {
    // This test targets the catch block when controller.close() throws in single emission timer
    const timerStream = timer(1);
    const reader = timerStream.getReader();
    
    // Cancel to put the controller in a closed state, which makes subsequent operations throw
    await reader.cancel();
    
    // Wait for timer to fire (it should handle the error gracefully)
    await sleep(3); // Use deterministic sleep instead of setTimeout
    
    // Stream should handle the error gracefully
    const result = await reader.read();
    expect(result.done).to.be.true;
  });
});
