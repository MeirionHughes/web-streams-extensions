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
});
