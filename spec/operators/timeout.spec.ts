import { expect } from "chai";
import { sleep } from "../../src/utils/sleep.js";
import { toArray, from, pipe,  buffer, take, debounceTime, tap, timeout } from '../../src/index.js';



describe("timeout", () => {
  it("will consume original stream if time between chunks less-than duration", async () => {
    let input =  async function*(){yield 1, yield 2, await sleep(50), yield 3};
    let expected = await toArray(from(input));
    let result = await toArray(pipe(from(input), timeout(100)));
    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })  

  it("will error if time between chunks exceeds duration", async () => {
    let input = async function*(){yield 1, yield 2, await sleep(150), yield 3};
    let error: Error = null;
    let result = null;
    try {
       result = await toArray(pipe(from(input), timeout(100)));
    } catch (err) {
      error = err;
    }
    expect(error).to.not.be.null;
    expect(result).to.be.null;
    expect(error.message.search("Stream timeout")).to.be.greaterThanOrEqual(0);
  })

  it("should throw error for non-positive duration", () => {
    expect(() => timeout(0)).to.throw("Timeout duration must be positive");
    expect(() => timeout(-1)).to.throw("Timeout duration must be positive");
  });

  it("should handle empty stream", async () => {
    const result = await toArray(
      pipe(
        from([]),
        timeout(100)
      )
    );

    expect(result).to.deep.equal([]);
  });

  it("should handle immediate timeout", async () => {
    const input = async function*() {
      yield 1;
      await sleep(50); // Longer than timeout
      yield 2;
    };

    let error: Error = null;
    try {
      await toArray(pipe(from(input), timeout(10)));
    } catch (err) {
      error = err;
    }

    expect(error).to.not.be.null;
    expect(error.message).to.include("Stream timeout after 10ms");
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
          timeout(1000)
        )
      );
      expect.fail('Expected stream to throw error');
    } catch (err) {
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal('Stream error');
    }
  });

  it("should handle cancellation", async () => {
    const input = async function*() {
      yield 1;
      await sleep(50);
      yield 2;
      await sleep(50);
      yield 3;
    };

    const stream = pipe(from(input), timeout(1000));
    const reader = stream.getReader();
    
    // Read first value
    const first = await reader.read();
    expect(first.value).to.equal(1);
    
    // Cancel the stream
    await reader.cancel('User cancelled');
    // If we get here, cancellation was handled
    expect(true).to.be.true;
  });

  it("should work with custom highWaterMark", async () => {
    const result = await toArray(
      pipe(
        from([1, 2, 3]),
        (src) => timeout(1000)(src, { highWaterMark: 1 })
      )
    );

    expect(result).to.deep.equal([1, 2, 3]);
  });

  it("should handle single value stream", async () => {
    const result = await toArray(
      pipe(
        from([42]),
        timeout(100)
      )
    );

    expect(result).to.deep.equal([42]);
  });

  it("should handle fast stream", async () => {
    const input = [1, 2, 3, 4, 5];
    const result = await toArray(
      pipe(
        from(input),
        timeout(100)
      )
    );

    expect(result).to.deep.equal(input);
  });

  it("should handle stream that completes exactly at timeout", async () => {
    const input = async function*() {
      yield 1;
      yield 2;
      await sleep(95); // Just under timeout
      yield 3;
    };

    const result = await toArray(
      pipe(
        from(input),
        timeout(100)
      )
    );

    expect(result).to.deep.equal([1, 2, 3]);
  });

  it("should handle cleanup errors during timeout", async () => {
    // Create a stream that throws on cancel
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        // Don't complete - force timeout
      },
      cancel() {
        throw new Error('Cancel error');
      }
    });

    let error: Error = null;
    try {
      await toArray(
        pipe(mockStream, timeout(50))
      );
    } catch (err) {
      error = err;
    }

    expect(error).to.not.be.null;
    expect(error.message).to.include("Stream timeout after 50ms");
  });

  it("should handle cleanup errors during stream error", async () => {
    const errorStream = new ReadableStream({
      async start(controller) {
        controller.enqueue(1);
        // Trigger error after timeout setup
        await sleep(10);
        controller.error(new Error('Stream error'));
      },
      cancel() {
        throw new Error('Cancel error');
      }
    });

    try {
      await toArray(
        pipe(errorStream, timeout(1000))
      );
      expect.fail('Expected stream to throw error');
    } catch (err) {
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal('Stream error');
    }
  });

  it("should handle cleanup errors during cancellation", async () => {
    const input = async function*() {
      yield 1;
      await sleep(100);
      yield 2;
    };

    // Create a mock stream that throws on cancel
    const mockStream = new ReadableStream({
      async start(controller) {
        const generator = input();
        let result = await generator.next();
        while (!result.done) {
          controller.enqueue(result.value);
          result = await generator.next();
        }
        controller.close();
      },
      cancel() {
        throw new Error('Cancel error');
      }
    });

    const stream = pipe(mockStream, timeout(1000));
    const reader = stream.getReader();
    
    await reader.read(); // Read first value
    
    // Should handle cancel errors gracefully
    await reader.cancel('test cancel');
    // If we get here, it handled the cleanup error
    expect(true).to.be.true;
  });

  it("should not timeout after completion", async () => {
    const input = async function*() {
      yield 1;
      yield 2;
      // Stream completes - no more values
    };

    const result = await toArray(
      pipe(
        from(input),
        timeout(50) // Short timeout but stream completes quickly
      )
    );

    expect(result).to.deep.equal([1, 2]);
  });

  it("should handle very long timeout", async () => {
    const result = await toArray(
      pipe(
        from([1, 2, 3]),
        timeout(2147483647) // Max 32-bit signed integer (about 24.8 days)
      )
    );

    expect(result).to.deep.equal([1, 2, 3]);
  });

  it("should clear timer when stream completes normally", async () => {
    const input = async function*() {
      yield 1;
      await sleep(10);
      yield 2;
      // Completes naturally
    };

    const result = await toArray(
      pipe(
        from(input),
        timeout(100)
      )
    );

    expect(result).to.deep.equal([1, 2]);
    // Test passes if no timeout errors occur after completion
  });
});
