import { expect } from "chai";
import { from, pipe, mapSync, toArray, throwError } from "../../src/index.js";

describe("mapSync", () => {
  it("should map values synchronously", async () => {
    const input = [1, 2, 3, 4];
    const expected = [2, 4, 6, 8];
    
    const result = await toArray(pipe(
      from(input),
      mapSync(x => x * 2)
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should filter out undefined values", async () => {
    const input = [1, 2, 3, 4, 5];
    const expected = [2, 4];
    
    const result = await toArray(pipe(
      from(input),
      mapSync(x => x % 2 === 0 ? x : undefined)
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should transform types", async () => {
    const input = [1, 2, 3, 4];
    const expected = ['1', '2', '3', '4'];
    
    const result = await toArray(pipe(
      from(input),
      mapSync(x => x.toString())
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should handle empty stream", async () => {
    const input = [];
    
    const result = await toArray(pipe(
      from(input),
      mapSync(x => x * 2)
    ));
    
    expect(result).to.deep.equal([]);
  });

  it("should handle selector errors", async () => {
    const input = [1, 2, 3, 4];
    
    try {
      await toArray(pipe(
        from(input),
        mapSync(x => {
          if (x === 3) throw new Error("Selector error");
          return x * 2;
        })
      ));
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.equal("Selector error");
    }
  });

  it("should work with complex transformations", async () => {
    const input = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
      { name: 'Charlie', age: 35 }
    ];
    
    const result = await toArray(pipe(
      from(input),
      mapSync(person => person.age >= 30 ? `${person.name} (adult)` : undefined)
    ));
    
    expect(result).to.deep.equal(['Alice (adult)', 'Charlie (adult)']);
  });

  it("should maintain order", async () => {
    const input = [3, 1, 4, 1, 5, 9];
    const expected = [9, 3, 12, 3, 15, 27];
    
    const result = await toArray(pipe(
      from(input),
      mapSync(x => x * 3)
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should handle null and undefined inputs", async () => {
    const input = [1, null, 3, undefined, 5];
    
    const result = await toArray(pipe(
      from(input),
      mapSync(x => x != null ? x * 2 : undefined)
    ));
    
    expect(result).to.deep.equal([2, 6, 10]);
  });

  it("should work with boolean transformations", async () => {
    const input = [1, 2, 3, 4, 5];
    const expected = [false, true, false, true, false];
    
    const result = await toArray(pipe(
      from(input),
      mapSync(x => x % 2 === 0)
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should handle stream errors", async () => {
    try {
      await toArray(pipe(
        throwError(new Error("source error")),
        mapSync(x => x * 2)
      ));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err.message).to.equal("source error");
    }
  });

  it("should handle cancellation properly", async () => {
    const stream = pipe(
      from([1, 2, 3, 4, 5]),
      mapSync(x => x * 2)
    );
    
    const reader = stream.getReader();
    const { value } = await reader.read();
    expect(value).to.equal(2);
    
    // Cancel the stream
    await reader.cancel();
  });

  it("should work with custom highWaterMark", async () => {
    const mapSyncOp = mapSync((x: number) => x * 2);
    const result = await toArray(pipe(
      from([1, 2, 3]),
      (src) => mapSyncOp(src, { highWaterMark: 1 })
    ));
    expect(result).to.deep.equal([2, 4, 6]);
  });

  it("should handle single value stream", async () => {
    const result = await toArray(pipe(
      from([42]),
      mapSync(x => x * 2)
    ));
    expect(result).to.deep.equal([84]);
  });

  it("should handle reader release errors during error cleanup", async () => {
    let readerFromOutside;
    
    const mockSrc = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.enqueue(2);
      }
    });
    
    const stream = pipe(
      mockSrc,
      mapSync(x => {
        if (x === 2) throw new Error("processing error");
        return x * 2;
      })
    );
    
    try {
      await toArray(stream);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err.message).to.equal("processing error");
    }
  });
});
