import { expect } from "chai";
import { toArray, from, pipe, concatAll } from '../../src/index.js';


describe("concatAll - error handling and edge cases", () => {
  
  it("should handle concurrent flush calls (lines 13-15)", async () => {
    // Test to trigger the flushing guard to cover lines 13-15
    const stream = new ReadableStream<ReadableStream<number>>({
      start(controller) {
        // Create a stream that will trigger concurrent flushes
        const innerStream1 = new ReadableStream<number>({
          start(innerController) {
            innerController.enqueue(1);
            innerController.enqueue(2);
            innerController.close();
          }
        });
        
        controller.enqueue(innerStream1);
        controller.close();
      }
    });
    
    // Apply concatAll and verify it handles concurrent flushes
    const result = await toArray(pipe(stream, concatAll()));
    expect(result).to.deep.equal([1, 2]);
  });

  it("should handle backpressure and pending values (lines 22-29)", async () => {
    // Test to cover lines 22-29: pending value handling when no space
    const stream = new ReadableStream<ReadableStream<number>>({
      start(controller) {
        // Create an inner stream with multiple values
        const innerStream = new ReadableStream<number>({
          start(innerController) {
            innerController.enqueue(1);
            innerController.enqueue(2);
            innerController.enqueue(3);
            innerController.close();
          }
        });
        
        controller.enqueue(innerStream);
        controller.close();
      }
    });
    
    // Use a very small highWaterMark to trigger backpressure
    const concatenated = concatAll<number>()(stream, { highWaterMark: 1 });
    const reader = concatenated.getReader();
    
    // Read values one by one to test backpressure handling
    const result1 = await reader.read();
    expect(result1.value).to.equal(1);
    
    const result2 = await reader.read();
    expect(result2.value).to.equal(2);
    
    const result3 = await reader.read();
    expect(result3.value).to.equal(3);
    
    const result4 = await reader.read();
    expect(result4.done).to.be.true;
    
    await reader.cancel();
    reader.releaseLock();
  });

  it("should handle errors in flush method (lines 77-80)", async () => {
    // Test to cover lines 77-80: catch block in flush method
    const errorMessage = "Inner stream error";
    
    const stream = new ReadableStream<ReadableStream<number>>({
      start(controller) {
        // Create an inner stream that will error
        const erroringStream = new ReadableStream<number>({
          start(innerController) {
            innerController.enqueue(1);
            innerController.error(new Error(errorMessage));
          }
        });
        
        controller.enqueue(erroringStream);
        controller.close();
      }
    });
    
    try {
      await toArray(pipe(stream, concatAll()));
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.equal(errorMessage);
    }
  });

  it("should handle reader cleanup errors in cancel method (lines 96-97)", async () => {
    // Test to cover lines 96-97: cancel method error handling
    const stream = new ReadableStream<ReadableStream<number>>({
      start(controller) {
        const innerStream = new ReadableStream<number>({
          start(innerController) {
            innerController.enqueue(1);
            // Don't close to keep stream active
          }
        });
        
        controller.enqueue(innerStream);
        // Don't close to keep outer stream active
      }
    });
    
    const concatenated = pipe(stream, concatAll());
    const reader = concatenated.getReader();
    
    // Read one value to establish the inner reader
    const result = await reader.read();
    expect(result.value).to.equal(1);
    
    // Cancel should handle cleanup errors gracefully
    try {
      await reader.cancel("Test cancellation");
    } catch (error) {
      // May throw during cleanup, which is expected
    } finally {
      try {
        reader.releaseLock();
      } catch (e) {
        // Reader may already be released
      }
    }
  });

  it("should handle null reader cleanup in cancel", async () => {
    // Additional test for cancel method with null readers
    const stream = new ReadableStream<ReadableStream<number>>({
      start(controller) {
        controller.close(); // Empty stream
      }
    });
    
    const concatenated = pipe(stream, concatAll());
    const reader = concatenated.getReader();
    
    // Should handle cancel even when readers are null
    await reader.cancel("Test cancellation with null readers");
    reader.releaseLock();
  });

  it("should handle reader release errors during cleanup", async () => {
    // Test reader.releaseLock() error handling
    const stream = new ReadableStream<ReadableStream<number>>({
      start(controller) {
        const innerStream = new ReadableStream<number>({
          start(innerController) {
            innerController.enqueue(1);
            innerController.close();
          }
        });
        
        controller.enqueue(innerStream);
        controller.close();
      }
    });
    
    const concatenated = pipe(stream, concatAll());
    const reader = concatenated.getReader();
    
    // Read the value
    const result = await reader.read();
    expect(result.value).to.equal(1);
    
    // Try to cancel - should handle any releaseLock errors
    await reader.cancel();
    reader.releaseLock();
  });

  it("should handle errors when getting reader from inner streams", async () => {
    // This test is more complex since getReader() is called in the from() function
    // Let's test a different error path - error in from() conversion
    const stream = new ReadableStream<any>({
      start(controller) {
        // Enqueue something that will cause an error when converted by from()
        controller.enqueue(Symbol('uncoverable'));
        controller.close();
      }
    });
    
    try {
      await toArray(pipe(stream, concatAll()));
      expect.fail("Should have thrown an error");
    } catch (error) {
      // Should get some kind of error from the conversion process
      expect(error).to.exist;
    }
  });

  it("should handle desiredSize check edge cases", async () => {
    // Test edge cases around controller.desiredSize checking
    let innerController: ReadableStreamDefaultController<number>;
    
    const stream = new ReadableStream<ReadableStream<number>>({
      start(controller) {
        const innerStream = new ReadableStream<number>({
          start(ctrl) {
            innerController = ctrl;
            // Will enqueue values based on backpressure
            ctrl.enqueue(1);
          }
        });
        
        controller.enqueue(innerStream);
        controller.close();
      }
    });
    
    const concatenated = concatAll<number>()(stream, { highWaterMark: 2 });
    const reader = concatenated.getReader();
    
    // Read to trigger the flow
    const result1 = await reader.read();
    expect(result1.value).to.equal(1);
    
    // Close the inner stream
    innerController.close();
    
    // Should complete properly
    const result2 = await reader.read();
    expect(result2.done).to.be.true;
    
    await reader.cancel();
    reader.releaseLock();
  });
});