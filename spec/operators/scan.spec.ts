import { expect } from "chai";
import { first, from, map, pipe, scan, toArray } from "../../src/index.js";

describe("scan", () => {
  it("should emit accumulated values including seed", async () => {
    const input = [1, 2, 3, 4];
    const expected = [0, 1, 3, 6, 10]; // seed + accumulated values
    
    const result = await toArray(pipe(
      from(input),
      scan((acc, val) => acc + val, 0), 
      {highWaterMark: 16}
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should work with different types", async () => {
    const input = [1, 2, 3];
    const expected = ["", "1", "12", "123"];
    
    const result = await toArray(pipe(
      from(input),
      scan((acc, val) => acc + val.toString(), "")
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should pass index to accumulator", async () => {
    const input = [10, 20, 30];
    const expected = [100, 110, 131, 163]; // 100 + (10+0), 110 + (20+1), 131 + (30+2)
    
    const result = await toArray(pipe(
      from(input),
      scan((acc, val, index) => acc + val + index, 100)
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should handle async accumulator", async () => {
    const input = [1, 2, 3];
    const expected = [0, 1, 3, 6];
    
    const result = await toArray(pipe(
      from(input),
      scan(async (acc, val) => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return acc + val;
      }, 0)
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should handle empty stream", async () => {
    const result = await toArray(pipe(
      from([]),
      scan((acc, val) => acc + val, 42)
    ));
    
    expect(result).to.deep.equal([42]); // Should still emit seed
  });
});
