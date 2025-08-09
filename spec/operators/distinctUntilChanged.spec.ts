import { expect } from "chai";
import { distinctUntilChanged, from, pipe, toArray, throwError } from "../../src/index.js";

describe("distinctUntilChanged", () => {
  it("should filter out consecutive duplicates", async () => {
    const input = [1, 1, 2, 2, 2, 3, 3, 1, 1];
    const expected = [1, 2, 3, 1];
    
    const result = await toArray(pipe(
      from(input),
      distinctUntilChanged()
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should use custom comparison function", async () => {
    const input = [
      { id: 1, name: "a" },
      { id: 1, name: "b" }, // Same id, should be filtered
      { id: 2, name: "c" },
      { id: 2, name: "d" }, // Same id, should be filtered
      { id: 1, name: "e" }  // Different id, should pass
    ];
    
    const expected = [
      { id: 1, name: "a" },
      { id: 2, name: "c" },
      { id: 1, name: "e" }
    ];
    
    const result = await toArray(pipe(
      from(input),
      distinctUntilChanged((a, b) => a.id === b.id)
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should emit first value even if undefined", async () => {
    const input = [undefined, undefined, 1, 1, 2];
    const expected = [undefined, 1, 2];
    
    const result = await toArray(pipe(
      from(input),
      distinctUntilChanged()
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should handle empty stream", async () => {
    const result = await toArray(pipe(
      from([]),
      distinctUntilChanged()
    ));
    
    expect(result).to.deep.equal([]);
  });

  it("should handle single value", async () => {
    const result = await toArray(pipe(
      from([42]),
      distinctUntilChanged()
    ));
    
    expect(result).to.deep.equal([42]);
  });

  it("should handle stream errors", async () => {
    try {
      await toArray(pipe(
        throwError(new Error("test error")),
        distinctUntilChanged()
      ));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err.message).to.equal("test error");
    }
  });

  it("should handle errors in comparison function", async () => {
    try {
      await toArray(pipe(
        from([1, 2, 3]),
        distinctUntilChanged((a, b) => { 
          if (a === 2) throw new Error("compare error");
          return a === b;
        })
      ));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err.message).to.equal("compare error");
    }
  });

  it("should handle cancellation properly", async () => {
    const stream = pipe(
      from([1, 1, 2, 2, 3]),
      distinctUntilChanged()
    );
    
    const reader = stream.getReader();
    const { value } = await reader.read();
    expect(value).to.equal(1);
    
    // Cancel the stream
    await reader.cancel();
  });

  it("should work with custom highWaterMark", async () => {
    const distinctOp = distinctUntilChanged();
    const result = await toArray(pipe(
      from([1, 1, 2, 2, 3]),
      (src) => distinctOp(src, { highWaterMark: 1 })
    ));
    expect(result).to.deep.equal([1, 2, 3]);
  });

  it("should handle null values", async () => {
    const result = await toArray(pipe(
      from([null, null, 1, 1, null]),
      distinctUntilChanged()
    ));
    expect(result).to.deep.equal([null, 1, null]);
  });

  it("should handle boolean values", async () => {
    const result = await toArray(pipe(
      from([true, true, false, false, true]),
      distinctUntilChanged()
    ));
    expect(result).to.deep.equal([true, false, true]);
  });

  it("should handle string values", async () => {
    const result = await toArray(pipe(
      from(['a', 'a', 'b', 'b', 'c']),
      distinctUntilChanged()
    ));
    expect(result).to.deep.equal(['a', 'b', 'c']);
  });

  it("should handle complex comparison logic", async () => {
    const result = await toArray(pipe(
      from([1, 2, 4, 8, 16]),
      distinctUntilChanged((a, b) => Math.abs(a - b) < 2) // Consider consecutive if diff < 2
    ));
    expect(result).to.deep.equal([1, 4, 8, 16]);
  });

  it("should work with different data types", async () => {
    const result = await toArray(pipe(
      from(['1', '1', 1, 1, '2']),
      distinctUntilChanged()
    ));
    expect(result).to.deep.equal(['1', 1, '2']);
  });
});
