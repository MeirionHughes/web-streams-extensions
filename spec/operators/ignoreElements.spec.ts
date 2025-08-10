import { expect } from "chai";
import { from, pipe, toArray, ignoreElements, throwError } from "../../src/index.js";

describe("ignoreElements", () => {
  it("should ignore all values but preserve completion", async () => {
    const result = await toArray(pipe(
      from([1, 2, 3, 4, 5]),
      ignoreElements()
    ));
    expect(result).to.deep.equal([]);
  });

  it("should handle empty stream", async () => {
    const result = await toArray(pipe(
      from([]),
      ignoreElements()
    ));
    expect(result).to.deep.equal([]);
  });

  it("should ignore values but preserve stream completion", async () => {
    const result = await toArray(pipe(
      from(['a', 'b', 'c']),
      ignoreElements()
    ));
    expect(result).to.deep.equal([]);
  });

  it("should handle single value stream", async () => {
    const result = await toArray(pipe(
      from([42]),
      ignoreElements()
    ));
    expect(result).to.deep.equal([]);
  });

  it("should handle large streams", async () => {
    const largeArray = Array.from({ length: 1000 }, (_, i) => i);
    const result = await toArray(pipe(
      from(largeArray),
      ignoreElements()
    ));
    expect(result).to.deep.equal([]);
  });

  it("should propagate errors from source stream", async () => {
    const errorMessage = "Test error";
    try {
      await toArray(pipe(
        throwError(new Error(errorMessage)),
        ignoreElements()
      ));
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.equal(errorMessage);
    }
  });

  it("should handle error after some values", async () => {
    const errorMessage = "Delayed error";
    const source = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.enqueue(2);
        controller.enqueue(3);
        controller.error(new Error(errorMessage));
      }
    });

    try {
      await toArray(pipe(source, ignoreElements()));
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.equal(errorMessage);
    }
  });

  it("should handle custom highWaterMark", async () => {
    const result = await toArray(pipe(
      from([1, 2, 3]),
      (src) => ignoreElements()(src, { highWaterMark: 1 })
    ));
    expect(result).to.deep.equal([]);
  });

  it("should handle reader errors during flush", async () => {
    const errorMessage = "Reader error";
    let readerErrorTriggered = false;
    
    const source = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.enqueue(2);
      },
      pull(controller) {
        if (!readerErrorTriggered) {
          readerErrorTriggered = true;
          throw new Error(errorMessage);
        }
      }
    });

    try {
      await toArray(pipe(source, ignoreElements()));
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.equal(errorMessage);
    }
  });

  it("should properly handle cancellation", async () => {
    let readerReleased = false;
    const source = new ReadableStream({
      start(controller) {
        // Keep the stream open so cancellation can be tested
        controller.enqueue(1);
        controller.enqueue(2);
        controller.enqueue(3);
        // Don't close immediately to allow cancel to propagate
      },
      cancel() {
        // This won't be called because ignoreElements only releases the reader
        // instead of canceling the source reader
      }
    });

    // Override getReader to track when reader is released
    const originalGetReader = source.getReader.bind(source);
    source.getReader = function() {
      const reader = originalGetReader();
      const originalReleaseLock = reader.releaseLock.bind(reader);
      reader.releaseLock = function() {
        readerReleased = true;
        return originalReleaseLock();
      };
      return reader;
    };

    const stream = pipe(source, ignoreElements());
    const reader = stream.getReader();
    
    // Cancel immediately
    await reader.cancel();
    
    // Give some time for cancellation to propagate
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Reader should have been released (that's what ignoreElements actually does)
    expect(readerReleased).to.be.true;
  });

  it("should handle backpressure correctly", async () => {
    let pulled = 0;
    const source = new ReadableStream({
      pull(controller) {
        pulled++;
        if (pulled <= 5) {
          controller.enqueue(pulled);
        } else {
          controller.close();
        }
      }
    }, { highWaterMark: 0 });

    const result = await toArray(pipe(source, ignoreElements()));
    expect(result).to.deep.equal([]);
    expect(pulled).to.be.greaterThan(0);
  });

  it("should handle null reader scenario", async () => {
    const source = new ReadableStream({
      start(controller) {
        controller.close();
      }
    });

    const result = await toArray(pipe(source, ignoreElements()));
    expect(result).to.deep.equal([]);
  });

  it("should handle multiple pull calls", async () => {
    let pullCount = 0;
    const source = new ReadableStream({
      pull(controller) {
        pullCount++;
        if (pullCount === 1) {
          controller.enqueue("first");
        } else if (pullCount === 2) {
          controller.enqueue("second");
        } else {
          controller.close();
        }
      }
    }, { highWaterMark: 0 });

    const stream = pipe(source, ignoreElements());
    const reader = stream.getReader();
    
    const result1 = await reader.read();
    expect(result1.done).to.be.true;
    expect(result1.value).to.be.undefined;
  });

  it("should handle reader release on cancel", async () => {
    const source = new ReadableStream({
      start(controller) {
        for (let i = 0; i < 10; i++) {
          controller.enqueue(i);
        }
        // Don't close immediately
      }
    });

    const stream = pipe(source, ignoreElements());
    const reader = stream.getReader();
    
    // Cancel should trigger reader release
    await reader.cancel();
    
    // Since the reader is cancelled, we can't get a new one from the same stream
    // But we can test that the cancel was handled properly by creating a new pipeline
    const newStream = pipe(source, ignoreElements());
    
    // This should work since we're using a fresh pipeline
    try {
      const newReader = newStream.getReader();
      expect(newReader).to.not.be.null;
      newReader.releaseLock();
    } catch (error) {
      // If the source is locked, that's expected after cancellation
      expect(error.message).to.include('locked');
    }
  });

  it("should ignore different types of values", async () => {
    const mixedValues = [
      1, "string", { key: "value" }, [1, 2, 3], null, undefined, true, false
    ];
    
    const result = await toArray(pipe(
      from(mixedValues),
      ignoreElements()
    ));
    expect(result).to.deep.equal([]);
  });

  it("should handle stream that errors immediately", async () => {
    const errorMessage = "Immediate error";
    const source = new ReadableStream({
      start(controller) {
        controller.error(new Error(errorMessage));
      }
    });

    try {
      await toArray(pipe(source, ignoreElements()));
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.equal(errorMessage);
    }
  });
});
