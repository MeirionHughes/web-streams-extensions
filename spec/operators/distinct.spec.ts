import { expect } from "chai";
import { from, pipe, toArray, distinct, throwError } from "../../src/index.js";

describe("distinct", () => {
  it("should filter out duplicates", async () => {
    const result = await toArray(pipe(
      from([1, 2, 2, 3, 1, 4, 3]),
      distinct()
    ));
    expect(result).to.deep.equal([1, 2, 3, 4]);
  });

  it("should work with key selector", async () => {
    const result = await toArray(pipe(
      from([
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
        { id: 1, name: 'John Doe' },
        { id: 3, name: 'Bob' }
      ]),
      distinct(person => person.id)
    ));
    expect(result.length).to.equal(3);
    expect(result.map(p => p.id)).to.deep.equal([1, 2, 3]);
  });

  it("should handle empty stream", async () => {
    const result = await toArray(pipe(
      from([]),
      distinct()
    ));
    expect(result).to.deep.equal([]);
  });

  it("should handle single value", async () => {
    const result = await toArray(pipe(
      from([42]),
      distinct()
    ));
    expect(result).to.deep.equal([42]);
  });

  it("should handle stream errors", async () => {
    try {
      await toArray(pipe(
        throwError(new Error("test error")),
        distinct()
      ));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err.message).to.equal("test error");
    }
  });

  it("should handle errors in key selector", async () => {
    try {
      await toArray(pipe(
        from([1, 2, 3]),
        distinct((value) => { 
          if (value === 2) throw new Error("selector error");
          return value;
        })
      ));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err.message).to.equal("selector error");
    }
  });

  it("should handle cancellation properly", async () => {
    const stream = pipe(
      from([1, 2, 3, 4, 5]),
      distinct()
    );
    
    const reader = stream.getReader();
    const { value } = await reader.read();
    expect(value).to.equal(1);
    
    // Cancel the stream
    await reader.cancel();
  });

  it("should work with custom highWaterMark", async () => {
    const distinctOp = distinct();
    const result = await toArray(pipe(
      from([1, 2, 2, 3, 1]),
      (src) => distinctOp(src, { highWaterMark: 1 })
    ));
    expect(result).to.deep.equal([1, 2, 3]);
  });

  it("should handle null and undefined values", async () => {
    const result = await toArray(pipe(
      from([null, undefined, null, 1, undefined, 2]),
      distinct()
    ));
    expect(result).to.deep.equal([null, undefined, 1, 2]);
  });

  it("should handle objects with complex equality", async () => {
    const obj1 = { x: 1 };
    const obj2 = { x: 1 }; // Different object, same content
    const result = await toArray(pipe(
      from([obj1, obj2, obj1]),
      distinct()
    ));
    expect(result).to.deep.equal([obj1, obj2]); // Both objects preserved as they're different references
  });

  it("should handle very large stream efficiently", async () => {
    const largeArray = Array.from({ length: 10000 }, (_, i) => i % 100);
    const result = await toArray(pipe(
      from(largeArray),
      distinct()
    ));
    expect(result.length).to.equal(100);
    expect(result).to.deep.equal(Array.from({ length: 100 }, (_, i) => i));
  });

  it("should work with different data types", async () => {
    const result = await toArray(pipe(
      from(['a', 1, 'a', 2, 1, 'b']),
      distinct()
    ));
    expect(result).to.deep.equal(['a', 1, 2, 'b']);
  });
});
