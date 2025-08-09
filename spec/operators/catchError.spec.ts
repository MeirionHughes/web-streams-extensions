import { expect } from "chai";
import { from, pipe, catchError, toArray, Subject, map } from "../../src/index.js";

describe("catchError", () => {
  it("should catch and recover from errors", async () => {
    const erroringSubject = new Subject<number>();
    const fallbackStream = from([100, 200]);
    
    const resultPromise = toArray(pipe(
      erroringSubject.readable,
      catchError(() => fallbackStream)
    ));
    
    erroringSubject.next(1);
    erroringSubject.error(new Error("Test error"));
    
    const result = await resultPromise;
    expect(result).to.deep.equal([1, 100, 200]);
  });

  it("should not interfere if no error occurs", async () => {
    const input = [1, 2, 3, 4];
    const fallbackStream = from([100, 200]);
    
    const result = await toArray(pipe(
      from(input),
      catchError(() => fallbackStream)
    ));
    
    expect(result).to.deep.equal([1, 2, 3, 4]);
  });

  it("should handle errors in operators", async () => {
    const input = [1, 2, 3, 4];
    const fallbackStream = from([100]);
    
    const result = await toArray(pipe(
      from(input),
      map(x => {
        if (x === 3) throw new Error("Map error");
        return x * 2;
      }),
      catchError(() => fallbackStream)
    ));
    
    expect(result).to.deep.equal([2, 4, 100]);
  });

  it("should pass error to handler function", async () => {
    const erroringSubject = new Subject<number>();
    let caughtError: Error | null = null;
    
    const resultPromise = toArray(pipe(
      erroringSubject.readable,
      catchError((error) => {
        caughtError = error;
        return from([999]);
      })
    ));
    
    const testError = new Error("Test error with details");
    erroringSubject.error(testError);
    
    await resultPromise;
    expect(caughtError).to.equal(testError);
  });

  it("should handle empty fallback stream", async () => {
    const erroringSubject = new Subject<number>();
    const fallbackStream = from([]);
    
    const resultPromise = toArray(pipe(
      erroringSubject.readable,
      catchError(() => fallbackStream)
    ));
    
    erroringSubject.next(1);
    erroringSubject.error(new Error("Test error"));
    
    const result = await resultPromise;
    expect(result).to.deep.equal([1]);
  });

  it("should handle multiple errors", async () => {
    const erroringSubject = new Subject<number>();
    let errorCount = 0;
    
    const resultPromise = toArray(pipe(
      erroringSubject.readable,
      catchError((error) => {
        errorCount++;
        return from([errorCount * 100]);
      })
    ));
    
    erroringSubject.error(new Error("First error"));
    
    const result = await resultPromise;
    expect(result).to.deep.equal([100]);
    expect(errorCount).to.equal(1);
  });

  it("should handle errors in error handler", async () => {
    const erroringSubject = new Subject<number>();
    
    const resultPromise = toArray(pipe(
      erroringSubject.readable,
      catchError(() => {
        throw new Error("Handler error");
      })
    ));
    
    erroringSubject.error(new Error("Original error"));
    
    try {
      await resultPromise;
      expect.fail("Should have thrown an error");
    } catch (error) {
      // The error handler itself errored, so it should propagate
      expect(error.message).to.equal("Handler error");
    }
  });

  it("should work with different error types", async () => {
    const erroringSubject = new Subject<number>();
    
    const resultPromise = toArray(pipe(
      erroringSubject.readable,
      catchError((error) => {
        if (error instanceof TypeError) {
          return from([1000]);
        } else {
          return from([2000]);
        }
      })
    ));
    
    erroringSubject.error(new TypeError("Type error"));
    
    const result = await resultPromise;
    expect(result).to.deep.equal([1000]);
  });

  it("should handle different error handler logic", async () => {
    const erroringSubject = new Subject<number>();
    
    const resultPromise = toArray(pipe(
      erroringSubject.readable,
      catchError((error) => {
        // Simulate conditional logic
        if (error.message.includes("test")) {
          return from([500]);
        }
        return from([600]);
      })
    ));
    
    erroringSubject.error(new Error("This is a test error"));
    
    const result = await resultPromise;
    expect(result).to.deep.equal([500]);
  });

  it("should handle error in fallback stream", async () => {
    const erroringSubject = new Subject<number>();
    
    const fallbackStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.error(new Error("Fallback error"));
      }
    });
    
    const resultPromise = toArray(pipe(
      erroringSubject.readable,
      catchError(() => fallbackStream)
    ));
    
    erroringSubject.error(new Error("Original error"));
    
    try {
      await resultPromise;
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.equal("Fallback error");
    }
  });

  it("should handle cancellation properly", async () => {
    const erroringSubject = new Subject<number>();
    let sourceCancelled = false;
    
    // Override getReader to track cancellation
    const originalGetReader = erroringSubject.readable.getReader.bind(erroringSubject.readable);
    erroringSubject.readable.getReader = function() {
      const reader = originalGetReader();
      const originalCancel = reader.cancel.bind(reader);
      reader.cancel = function() {
        sourceCancelled = true;
        return originalCancel();
      };
      return reader;
    };
    
    const fallbackStream = from([100, 200]);
    
    const stream = pipe(
      erroringSubject.readable,
      catchError(() => fallbackStream)
    );
    
    const reader = stream.getReader();
    
    // Trigger error to switch to fallback
    erroringSubject.error(new Error("Test error"));
    
    // Read one value then cancel
    await reader.read();
    await reader.cancel();
    
    // Cancel should be handled properly (fallback reader will be released)
    expect(sourceCancelled).to.be.false; // Source was already errored, so not cancelled
  });

  it("should handle error when both reader and fallbackReader are null", async () => {
    const source = new ReadableStream({
      start(controller) {
        // Close immediately to trigger null reader scenario
        controller.close();
      }
    });
    
    const result = await toArray(pipe(
      source,
      catchError(() => from([999]))
    ));
    
    expect(result).to.deep.equal([]);
  });

  it("should handle backpressure with custom highWaterMark", async () => {
    const source = new ReadableStream({
      start(controller) {
        controller.error(new Error("Test error"));
      }
    });
    
    const fallbackValues = [1, 2, 3, 4, 5];
    
    const result = await toArray(pipe(
      source,
      (src) => catchError(() => from(fallbackValues))(src, { highWaterMark: 1 })
    ));
    
    expect(result).to.deep.equal(fallbackValues);
  });

  it("should handle reader release errors during cancellation", async () => {
    let readerReleased = false;
    const source = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        // Don't close so we can test cancellation
      }
    });

    // Mock getReader to track reader release
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
    
    const stream = pipe(
      source,
      catchError(() => from([999]))
    );
    
    const reader = stream.getReader();
    await reader.cancel();
    
    expect(readerReleased).to.be.true;
  });

  it("should handle multiple consecutive fallback reads", async () => {
    const source = new ReadableStream({
      start(controller) {
        controller.error(new Error("Source error"));
      }
    });
    
    const fallbackValues = [1, 2, 3, 4, 5];
    
    const result = await toArray(pipe(
      source,
      catchError(() => from(fallbackValues))
    ));
    
    expect(result).to.deep.equal(fallbackValues);
  });

  it("should handle empty source with fallback", async () => {
    const source = new ReadableStream({
      start(controller) {
        controller.error(new Error("Empty source error"));
      }
    });
    
    const result = await toArray(pipe(
      source,
      catchError(() => from([100, 200]))
    ));
    
    expect(result).to.deep.equal([100, 200]);
  });

  it("should handle pulled stream with fallback stream", async () => {
    let pullCount = 0;
    const source = new ReadableStream({
      pull(controller) {
        pullCount++;
        if (pullCount === 1) {
          controller.enqueue(1);
        } else {
          controller.error(new Error("Pull error"));
        }
      }
    }, { highWaterMark: 0 });
    
    const result = await toArray(pipe(
      source,
      catchError(() => from([999]))
    ));
    
    expect(result).to.deep.equal([1, 999]);
  });
});
