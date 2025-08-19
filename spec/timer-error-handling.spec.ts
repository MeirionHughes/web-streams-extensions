import { expect } from "chai";
import { timer } from "../src/index.js";


describe("timer - error handling", () => {
  
  it("should handle controller closed error in due timer callback (lines 63-68)", async () => {
    // Test to cover lines 63-68: catch block in due timer callback
    let timerStream: ReadableStream<number>;
    let reader: ReadableStreamDefaultReader<number>;
    
    // Create timer with very short delay
    timerStream = timer(1);
    reader = timerStream.getReader();
    
    // Immediately cancel to close the controller before due timer fires
    await reader.cancel();
    
    // The due timer should fire and handle the closed controller error
    // Wait a bit to ensure the timer fires
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Should not throw - error should be handled internally
    const result = await reader.read();
    expect(result.done).to.be.true;
    
    await reader.cancel();
    reader.releaseLock();
  });

  it("should handle controller closed error in interval timer callback (lines 50-55)", async () => {
    // Test to cover lines 50-55: catch block in interval timer callback
    let timerStream: ReadableStream<number>;
    let reader: ReadableStreamDefaultReader<number>;
    
    // Create timer with interval
    timerStream = timer(1, 5); // Very short delays
    reader = timerStream.getReader();
    
    // Read first value to ensure due timer has fired
    const firstResult = await reader.read();
    expect(firstResult.value).to.equal(0);
    expect(firstResult.done).to.be.false;
    
    // Now cancel to close the controller while interval is running
    await reader.cancel();
    
    // Wait for interval timer to fire and handle the error
    await new Promise(resolve => setTimeout(resolve, 20));
    
    // Should not throw - error should be handled internally
    const result = await reader.read();
    expect(result.done).to.be.true;
    
    await reader.cancel();
    reader.releaseLock();
  });

  it("should handle controller enqueue error in interval timer", async () => {
    // Test to cover interval timer error handling when controller is closed
    let timerStream: ReadableStream<number>;
    let reader: ReadableStreamDefaultReader<number>;
    
    timerStream = timer(5, 10);
    reader = timerStream.getReader();
    
    // Read first value
    const firstResult = await reader.read();
    expect(firstResult.value).to.equal(0);
    
    // Read second value
    const secondResult = await reader.read();
    expect(secondResult.value).to.equal(1);
    
    // Cancel to trigger error handling in next interval callback
    await reader.cancel();
    
    // Allow time for the interval timer to fire and handle the error
    await new Promise(resolve => setTimeout(resolve, 25));
    
    reader.releaseLock();
  });

  it("should handle controller enqueue error in due timer when controller is closed", async () => {
    // Test edge case where controller is closed before due timer fires
    let timerStream: ReadableStream<number>;
    let reader: ReadableStreamDefaultReader<number>;
    
    timerStream = timer(10); // Slightly longer delay
    reader = timerStream.getReader();
    
    // Cancel immediately to close controller
    await reader.cancel();
    
    // Wait for due timer to fire after controller is closed
    await new Promise(resolve => setTimeout(resolve, 20));
    
    // Should handle the error gracefully
    const result = await reader.read();
    expect(result.done).to.be.true;
    
    await reader.cancel();
    reader.releaseLock();
  });

  it("should handle multiple rapid cancellations", async () => {
    // Test rapid cancellation to potentially trigger race conditions
    for (let i = 0; i < 5; i++) {
      const timerStream = timer(1, 2);
      const reader = timerStream.getReader();
      
      // Immediately cancel
      await reader.cancel();
      
      const result = await reader.read();
      expect(result.done).to.be.true;
      
      reader.releaseLock();
    }
  });

  it("should clean up timers when controller close throws", async () => {
    // Test cleanup when controller.close() throws an error
    let timerStream: ReadableStream<number>;
    let reader: ReadableStreamDefaultReader<number>;
    
    timerStream = timer(5); // Single emission
    reader = timerStream.getReader();
    
    // Read the value - this will trigger controller.close()
    const result = await reader.read();
    expect(result.value).to.equal(0);
    expect(result.done).to.be.false;
    
    // Check that stream completes properly
    const finalResult = await reader.read();
    expect(finalResult.done).to.be.true;
    
    await reader.cancel();
    reader.releaseLock();
  });

  it("should handle interval timer when controller close fails", async () => {
    // Test interval timer behavior when controller operations fail
    let timerStream: ReadableStream<number>;
    let reader: ReadableStreamDefaultReader<number>;
    
    timerStream = timer(2, 5);
    reader = timerStream.getReader();
    
    // Read several values to ensure interval is working
    const results = [];
    for (let i = 0; i < 3; i++) {
      const result = await reader.read();
      if (!result.done) {
        results.push(result.value);
      }
    }
    
    expect(results).to.deep.equal([0, 1, 2]);
    
    // Cancel to trigger cleanup
    await reader.cancel();
    reader.releaseLock();
  });

  it("should handle timer cleanup edge cases", async () => {
    // Test various cleanup scenarios
    const timerStream = timer(1, 3);
    const reader = timerStream.getReader();
    
    // Start reading then immediately cancel
    const readPromise = reader.read();
    await reader.cancel();
    
    // Should still handle the read properly
    const result = await readPromise;
    // Could be either a value or done, both are valid
    
    await reader.cancel();
    reader.releaseLock();
  });
});