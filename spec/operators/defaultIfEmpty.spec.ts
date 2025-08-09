import { describe, it } from "mocha";
import { expect } from "chai";
import { from, pipe, toArray, defaultIfEmpty, of, throwError } from "../../src/index.js";

describe("defaultIfEmpty", () => {
  it("should provide default for empty stream", async () => {
    const result = await toArray(pipe(
      from([]),
      defaultIfEmpty('default')
    ));
    expect(result).to.deep.equal(['default']);
  });

  it("should pass through non-empty stream", async () => {
    const result = await toArray(pipe(
      from([1, 2, 3]),
      defaultIfEmpty(0)
    ));
    expect(result).to.deep.equal([1, 2, 3]);
  });

  it("should handle stream errors", async () => {
    const errorStream = throwError(new Error("test error"));
    
    try {
      await toArray(pipe(
        errorStream,
        defaultIfEmpty('default')
      ));
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.equal("test error");
    }
  });

  it("should work with custom highWaterMark", async () => {
    const result = await toArray(pipe(
      from([]),
      (src) => defaultIfEmpty('default')(src, { highWaterMark: 1 })
    ));
    expect(result).to.deep.equal(['default']);
  });

  it("should handle backpressure correctly", async () => {
    // Create a stream with many values to test pull method
    const largeArray = Array.from({ length: 20 }, (_, i) => i);
    const result = await toArray(pipe(
      from(largeArray),
      defaultIfEmpty(-1)
    ));
    expect(result).to.deep.equal(largeArray);
  });

  it("should handle cancellation properly", async () => {
    const stream = pipe(
      from([1, 2, 3, 4, 5]),
      defaultIfEmpty(0)
    );
    
    const reader = stream.getReader();
    
    // Read first value
    const first = await reader.read();
    expect(first.value).to.equal(1);
    expect(first.done).to.be.false;
    
    // Cancel the stream
    await reader.cancel();
    
    // Stream should be cancelled
    const result = await reader.read();
    expect(result.done).to.be.true;
  });

  it("should handle single value stream", async () => {
    const result = await toArray(pipe(
      of(42),
      defaultIfEmpty(0)
    ));
    expect(result).to.deep.equal([42]);
  });

  it("should work with different data types", async () => {
    // Test with objects
    const objResult = await toArray(pipe(
      from([]),
      defaultIfEmpty({ default: true })
    ));
    expect(objResult).to.deep.equal([{ default: true }]);

    // Test with arrays
    const arrResult = await toArray(pipe(
      from([]),
      defaultIfEmpty([1, 2, 3])
    ));
    expect(arrResult).to.deep.equal([[1, 2, 3]]);

    // Test with null/undefined
    const nullResult = await toArray(pipe(
      from([]),
      defaultIfEmpty(null)
    ));
    expect(nullResult).to.deep.equal([null]);

    const undefinedResult = await toArray(pipe(
      from([]),
      defaultIfEmpty(undefined)
    ));
    expect(undefinedResult).to.deep.equal([undefined]);
  });

  it("should handle very small highWaterMark", async () => {
    const result = await toArray(pipe(
      from([1, 2, 3]),
      (src) => defaultIfEmpty(0)(src, { highWaterMark: 1 })
    ));
    expect(result).to.deep.equal([1, 2, 3]);
  });

  it("should preserve order with multiple values", async () => {
    const values = [10, 20, 30, 40, 50];
    const result = await toArray(pipe(
      from(values),
      defaultIfEmpty(0)
    ));
    expect(result).to.deep.equal(values);
  });
});
