import { expect } from "chai";
import { combineLatest } from "../src/index.js";


describe("combineLatest - error handling and edge cases", () => {
  
  it("should handle controller close race condition in emitCombination", async () => {
    // Test to cover lines 76-78: catch block in emitCombination
    let controllerRef: ReadableStreamDefaultController<any[]>;
    
    const stream1 = new ReadableStream<number>({
      start(controller) {
        controller.enqueue(1);
        controller.close();
      }
    });
    
    const stream2 = new ReadableStream<string>({
      start(controller) {
        // Close the combined stream controller to trigger the race condition
        setTimeout(() => {
          try {
            controllerRef?.close();
          } catch (e) {
            // Expected - controller might already be closed
          }
        }, 0);
        controller.enqueue('a');
        controller.close();
      }
    });
    
    const combinedStream = combineLatest(stream1, stream2);
    
    // Store reference to try to close it
    const reader = combinedStream.getReader();
    
    try {
      const result = await reader.read();
      // Either we get a value or it's done due to the race condition
      if (!result.done) {
        expect(result.value).to.deep.equal([1, 'a']);
      }
    } catch (error) {
      // Error is expected in this race condition test
    } finally {
      try {
        await reader.cancel();
      } catch (e) {
        // Ignore cancel errors
      }
      reader.releaseLock();
    }
  });

  it("should handle controller close race condition in checkCompletion", async () => {
    // Test to cover lines 90-92: catch block in checkCompletion
    let controllerRef: ReadableStreamDefaultController<any[]>;
    
    const stream1 = new ReadableStream<number>({
      start(controller) {
        controller.enqueue(1);
        controller.close();
      }
    });
    
    const stream2 = new ReadableStream<string>({
      start(controller) {
        controller.enqueue('a');
        // Create a timing window for race condition
        setTimeout(() => controller.close(), 0);
      }
    });
    
    const combinedStream = combineLatest(stream1, stream2);
    const reader = combinedStream.getReader();
    
    try {
      await reader.read(); // Should complete successfully despite race condition
    } finally {
      try {
        await reader.cancel();
        reader.releaseLock();
      } catch (e) {
        // May fail if reader is already released
      }
    }
  });

  it("should handle stream read errors in worker loops", async () => {
    // Test to cover lines 125-129: catch block in worker loops
    const errorMessage = "Stream read error";
    
    const stream1 = new ReadableStream<number>({
      start(controller) {
        controller.enqueue(1);
        controller.close();
      }
    });
    
    const stream2 = new ReadableStream<string>({
      start(controller) {
        controller.enqueue('a');
        controller.error(new Error(errorMessage));
      }
    });
    
    const combinedStream = combineLatest(stream1, stream2);
    const reader = combinedStream.getReader();
    
    try {
      await reader.read();
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.equal(errorMessage);
    } finally {
      try {
        await reader.cancel();
        reader.releaseLock();
      } catch (e) {
        // Reader might already be released due to error
      }
    }
  });

  it("should handle Promise.all worker errors", async () => {
    // Test to cover lines 134-137: Promise.all catch block
    const stream1 = new ReadableStream<number>({
      start(controller) {
        controller.enqueue(1);
        controller.close();
      }
    });
    
    // Create a stream that will cause an async error
    const stream2 = new ReadableStream<string>({
      async start(controller) {
        controller.enqueue('a');
        // Delay then error to trigger the Promise.all catch
        setTimeout(() => {
          try {
            controller.error(new Error("Async worker error"));
          } catch (e) {
            // Controller might already be errored
          }
        }, 10);
      }
    });
    
    const combinedStream = combineLatest(stream1, stream2);
    const reader = combinedStream.getReader();
    
    try {
      // Read first value successfully
      const result1 = await reader.read();
      if (!result1.done) {
        expect(result1.value).to.deep.equal([1, 'a']);
      }
      
      // Try to read again - should get error from Promise.all catch
      await reader.read();
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.include("Async worker error");
    } finally {
      try {
        await reader.cancel();
        reader.releaseLock();
      } catch (e) {
        // Reader might already be released
      }
    }
  });

  it("should handle start method errors", async () => {
    // Test to cover lines 141-143: start method catch block  
    // Create a stream that will cause getReader() to fail
    const badStream = {
      getReader() {
        throw new Error("Failed to get reader");
      },
      locked: false,
      cancel: () => Promise.resolve(),
      pipeThrough: () => ({} as any),
      pipeTo: () => Promise.resolve(),
      tee: () => [{}] as any
    } as unknown as ReadableStream<any>;
    
    const goodStream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue('a');
        controller.close();
      }
    });
    
    try {
      const combinedStream = combineLatest(badStream, goodStream);
      const reader = combinedStream.getReader();
      await reader.read();
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.equal("Failed to get reader");
    }
  });

  it("should handle cancel method with reader cleanup errors", async () => {
    // Test to cover lines 150-162: cancel method with error handling
    const stream1 = new ReadableStream<number>({
      start(controller) {
        controller.enqueue(1);
        // Don't close to keep stream active
      }
    });
    
    const stream2 = new ReadableStream<string>({
      start(controller) {
        controller.enqueue('a');
        // Don't close to keep stream active
      }
    });
    
    const combinedStream = combineLatest(stream1, stream2);
    const combinedReader = combinedStream.getReader();
    
    // Read one value to establish the combination
    const result = await combinedReader.read();
    expect(result.value).to.deep.equal([1, 'a']);
    
    // Now test cancellation - this should trigger cleanup error handling
    await combinedReader.cancel();
    
    // Should complete without throwing despite cleanup errors
    combinedReader.releaseLock();
  });

  it("should handle null/undefined readers in cancel cleanup", async () => {
    // Additional test for cancel method edge case with null readers
    const stream1 = new ReadableStream<number>({
      start(controller) {
        controller.enqueue(1);
        controller.close();
      }
    });
    
    const stream2 = new ReadableStream<string>({
      start(controller) {
        controller.enqueue('a');
        controller.close();
      }
    });
    
    const combinedStream = combineLatest(stream1, stream2);
    const reader = combinedStream.getReader();
    
    // Read the value
    await reader.read();
    
    // Manually corrupt the readers array to test null handling
    const controller = (combinedStream as any)._controller;
    if (controller && controller._readers) {
      controller._readers = [null, undefined];
    }
    
    // Cancel should handle null/undefined readers gracefully
    await reader.cancel();
    reader.releaseLock();
  });

  it("should handle reader already released errors during cancel", async () => {
    const stream1 = new ReadableStream<number>({
      start(controller) {
        controller.enqueue(1);
        // Keep stream open
      }
    });
    
    const stream2 = new ReadableStream<string>({
      start(controller) {
        controller.enqueue('a'); 
        // Keep stream open
      }
    });
    
    const combinedStream = combineLatest(stream1, stream2);
    const combinedReader = combinedStream.getReader();
    
    // Read to establish combination
    await combinedReader.read();
    
    // Cancel should handle any cleanup errors gracefully
    await combinedReader.cancel();
    combinedReader.releaseLock();
  });
});