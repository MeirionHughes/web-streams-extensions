import { expect } from "chai";
import { from, pipe, reduce, toArray } from "../../src/index.js";

describe("reduce", () => {
  it("should emit only final accumulated value", async () => {
    const input = [1, 2, 3, 4];
    const expected = [10]; // Only final result, not intermediate values
    
    const result = await toArray(pipe(
      from(input),
      reduce((acc, val) => acc + val, 0)
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should work with different types", async () => {
    const input = [1, 2, 3];
    const expected = ["123"];
    
    const result = await toArray(pipe(
      from(input),
      reduce((acc, val) => acc + val.toString(), "")
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should pass index to accumulator", async () => {
    const input = [10, 20, 30];
    const expected = [163]; // 100 + (10+0) + (20+1) + (30+2)
    
    const result = await toArray(pipe(
      from(input),
      reduce((acc, val, index) => acc + val + index, 100)
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should handle async accumulator", async () => {
    const input = [1, 2, 3];
    const expected = [6];
    
    const result = await toArray(pipe(
      from(input),
      reduce(async (acc, val) => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return acc + val;
      }, 0)
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should handle empty stream", async () => {
    const result = await toArray(pipe(
      from([]),
      reduce((acc, val) => acc + val, 42)
    ));
    
    expect(result).to.deep.equal([42]); // Should emit seed for empty stream
  });
});
