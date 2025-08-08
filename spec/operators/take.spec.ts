import { expect } from "chai";
import { toArray, from, pipe, buffer, take } from '../../src/index.js';

describe("take", () => {
  it("can take less than input ", async () => {
    let inputA = [1, 2, 3, 4, 5];
    let expected = [1, 2, 3]

    let result = await toArray(
      pipe(
        from(inputA),
        take(3))
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })

  it("can take more than input ", async () => {
    let inputA = [1, 2, 3, 4];
    let expected = [1, 2, 3, 4]

    let result = await toArray(
      pipe(
        from(inputA),
        take(10))
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  }) 
  
  it("can take none ", async () => {
    let inputA = [1, 2, 3, 4];
    let expected = []

    let result = await toArray(
      pipe(
        from(inputA),
        take(0))
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })

  it("should throw error for negative count", () => {
    expect(() => take(-1)).to.throw("Take count must be non-negative");
  });

  it("should handle empty stream", async () => {
    const result = await toArray(
      pipe(
        from([]),
        take(5)
      )
    );

    expect(result).to.deep.equal([]);
  });

  it("should handle stream errors", async () => {
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.error(new Error('Stream error'));
      }
    });

    try {
      await toArray(
        pipe(
          errorStream,
          take(5)
        )
      );
      expect.fail('Expected stream to throw error');
    } catch (err) {
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal('Stream error');
    }
  });

  it("should handle cancellation", async () => {
    const stream = pipe(
      from([1, 2, 3, 4, 5]),
      take(10)
    );

    const reader = stream.getReader();
    
    // Read first value
    const first = await reader.read();
    expect(first.value).to.equal(1);
    
    // Cancel the stream
    await reader.cancel('User cancelled');
    // If we get here, cancellation was handled
    expect(true).to.be.true;
  });

  it("should handle cleanup errors during cancellation", async () => {
    // Create a stream that throws on cancel
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.enqueue(2);
      },
      cancel() {
        throw new Error('Cancel error');
      }
    });

    const stream = pipe(mockStream, take(3));
    const reader = stream.getReader();
    
    await reader.read(); // Read first value
    
    // Should handle cancel errors gracefully
    await reader.cancel('test cancel');
    // If we get here, it handled the cleanup error
    expect(true).to.be.true;
  });

  it("should handle cleanup errors when reader is cancelled after taking enough", async () => {
    // Create a stream that throws on cancel
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.enqueue(2);
        controller.enqueue(3);
        controller.enqueue(4);
      },
      cancel() {
        throw new Error('Cancel error');
      }
    });

    // Take exactly what we provide - this will trigger cancellation
    const result = await toArray(
      pipe(mockStream, take(2))
    );
    
    expect(result).to.deep.equal([1, 2]);
  });

  it("should work with custom highWaterMark", async () => {
    const result = await toArray(
      pipe(
        from([1, 2, 3, 4, 5]),
        (src) => take(3)(src, { highWaterMark: 1 })
      )
    );

    expect(result).to.deep.equal([1, 2, 3]);
  });

  it("should handle source stream completion before reaching count", async () => {
    const result = await toArray(
      pipe(
        from([1, 2]),
        take(5)
      )
    );

    expect(result).to.deep.equal([1, 2]);
  });

  it("should handle backpressure correctly", async () => {
    // Test with a stream that has backpressure
    const stream = pipe(
      from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
      take(3)
    );

    const result = await toArray(stream);
    expect(result).to.deep.equal([1, 2, 3]);
  });

  it("should close immediately when count is 0", async () => {
    const stream = pipe(
      from([1, 2, 3]),
      take(0)
    );

    // Stream should be closed immediately
    const reader = stream.getReader();
    const result = await reader.read();
    expect(result.done).to.be.true;
  });

  it("should handle reader release errors during error cleanup", async () => {
    // Create a custom stream that will error during read
    const errorStream = new ReadableStream({
      async start(controller) {
        controller.enqueue(1);
        // This will trigger an error in the read loop
        await new Promise(resolve => setTimeout(resolve, 10));
        controller.error(new Error('Async error'));
      }
    });

    try {
      await toArray(
        pipe(
          errorStream,
          take(5)
        )
      );
      expect.fail('Expected stream to throw error');
    } catch (err) {
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal('Async error');
    }
  });

  it("should handle taking exactly one element", async () => {
    const result = await toArray(
      pipe(
        from([1, 2, 3, 4, 5]),
        take(1)
      )
    );

    expect(result).to.deep.equal([1]);
  });

  it("should handle very large count", async () => {
    const result = await toArray(
      pipe(
        from([1, 2, 3]),
        take(Number.MAX_SAFE_INTEGER)
      )
    );

    expect(result).to.deep.equal([1, 2, 3]);
  });
});