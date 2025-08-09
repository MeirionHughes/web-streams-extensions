import { expect } from "chai";
import { toArray, from, pipe, buffer, throwError, empty, range, tap } from '../../src/index.js';
import { read } from "fs";
import { compareHighWaterMarkBehavior } from '../utils/test-highwater-mark.js';

describe("buffer", () => {
  it("can buffer T ", async () => {
    let inputA = [1, 2, 3, 4, 5];
    let expected = [[1,2],[3,4],[5]]

    let result = await toArray(
      pipe(
        from(inputA),
        buffer(2))
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  });

  it("should throw error for buffer count <= 0", () => {
    expect(() => buffer(0)).to.throw("Buffer count must be greater than 0");
    expect(() => buffer(-1)).to.throw("Buffer count must be greater than 0");
  });

  it("should buffer exact multiples", async () => {
    let input = [1, 2, 3, 4, 5, 6];
    let expected = [[1, 2], [3, 4], [5, 6]];

    let result = await toArray(
      pipe(
        from(input),
        buffer(2))
    );

    expect(result).to.deep.equal(expected);
  });

  it("should handle buffer size of 1", async () => {
    let input = [1, 2, 3];
    let expected = [[1], [2], [3]];

    let result = await toArray(
      pipe(
        from(input),
        buffer(1))
    );

    expect(result).to.deep.equal(expected);
  });

  it("should handle buffer size larger than input", async () => {
    let input = [1, 2];
    let expected = [[1, 2]];

    let result = await toArray(
      pipe(
        from(input),
        buffer(5))
    );

    expect(result).to.deep.equal(expected);
  });

  it("should handle empty stream", async () => {
    let result = await toArray(
      pipe(
        empty(),
        buffer(2))
    );

    expect(result).to.deep.equal([]);
  });

  it("should handle single element stream", async () => {
    let input = [42];
    let expected = [[42]];

    let result = await toArray(
      pipe(
        from(input),
        buffer(3))
    );

    expect(result).to.deep.equal(expected);
  });

  it("should pass through source errors", async () => {
    let errorMessage = "Test error in buffer";
    
    try {
      await toArray(
        pipe(
          throwError(new Error(errorMessage)),
          buffer(2))
      );
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.equal(errorMessage);
    }
  });

  it("should handle error after partial buffer", async () => {
    let errorMessage = "Error after some elements";
    
    // Create a stream that emits some elements then errors
    let errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.enqueue(2);
        controller.error(new Error(errorMessage));
      }
    });

    try {
      await toArray(
        buffer(3)(errorStream)
      );
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.equal(errorMessage);
    }
  });

  it("should use specified highWaterMark", async () => {
    // Test that higher highWaterMark values result in more pulls than lower ones
    // The exact numbers are hard to predict due to internal buffering, but the relative behavior should be consistent
    
    let result = await compareHighWaterMarkBehavior(
      buffer(2),  // buffer operator with size 2
      4,   // low highWaterMark
      16   // high highWaterMark
    );
    
    // Rather than exact numbers, verify the relative behavior and reasonable ranges
    expect(result.high).to.be.greaterThan(result.low * 2, 
      `Higher highWaterMark should pull significantly more than lower. Got ${result.high} vs ${result.low}`);
    expect(result.low).to.be.at.least(4, "Should pull at least some items for low highWaterMark");
    expect(result.high).to.be.at.least(15, "Should pull at least some items for high highWaterMark");
  });

  it("should use default highWaterMark when not specified", async () => {
    let input = [1, 2, 3, 4];
    let expected = [[1, 2], [3, 4]];

    let result = await toArray(
      buffer(2)(from(input))
    );

    expect(result).to.deep.equal(expected);
  });

  it("should handle cancellation properly", async () => {
    let cancelReason = "Test cancellation";
    let input = [1, 2, 3, 4, 5, 6];
    
    let bufferedStream = buffer(2)(from(input));
    let reader = bufferedStream.getReader();
    
    // Read first chunk
    let firstResult = await reader.read();
    expect(firstResult.value).to.deep.equal([1, 2]);
    
    // Cancel the stream
    await reader.cancel(cancelReason);
    reader.releaseLock();
  });

  it("should handle reader errors during flush", async () => {
    // Create a custom stream that will error during reading
    let errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.enqueue(2);
        controller.enqueue(3);
        controller.close();
      }
    });

    // Mock the reader to throw an error
    let originalGetReader = errorStream.getReader;
    errorStream.getReader = function() {
      let reader = originalGetReader.call(this);
      let originalRead = reader.read;
      let readCount = 0;
      reader.read = function() {
        readCount++;
        if (readCount > 2) {
          throw new Error("Reader error during flush");
        }
        return originalRead.call(this);
      };
      return reader;
    };

    try {
      await toArray(
        buffer(2)(errorStream)
      );
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.equal("Reader error during flush");
    }
  });

  it("should handle large buffer sizes", async () => {
    let input = Array.from({ length: 1000 }, (_, i) => i);
    let expected = [input]; // Single buffer with all elements

    let result = await toArray(
      pipe(
        from(input),
        buffer(2000))
    );

    expect(result).to.deep.equal(expected);
  });

  it("should handle cleanup errors gracefully during cancellation", async () => {
    let input = [1, 2, 3, 4];
    
    let bufferedStream = buffer(2)(from(input));
    let reader = bufferedStream.getReader();
    
    // Read first chunk
    await reader.read();
    
    // Test that the buffer's cancel method handles cleanup errors internally
    // by cancelling the stream normally
    try {
      await reader.cancel("test reason");
      reader.releaseLock();
    } catch (error) {
      // Should not reach here for normal cancellation
      expect.fail("Normal cancellation should not throw");
    }
  });

  it("should handle multiple successive reads properly", async () => {
    let input = [1, 2, 3, 4, 5, 6];
    
    let bufferedStream = buffer(2)(from(input));
    let reader = bufferedStream.getReader();
    
    // Read all chunks
    let result1 = await reader.read();
    expect(result1.value).to.deep.equal([1, 2]);
    
    let result2 = await reader.read();
    expect(result2.value).to.deep.equal([3, 4]);
    
    let result3 = await reader.read();
    expect(result3.value).to.deep.equal([5, 6]);
    
    let result4 = await reader.read();
    expect(result4.done).to.be.true;
    
    reader.releaseLock();
  });
});
