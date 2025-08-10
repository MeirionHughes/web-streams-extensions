import { expect } from "chai";
import { range, toArray } from "../src/index.js";

describe("range", () => {
  it("should emit sequence of numbers", async () => {
    const result = await toArray(range(1, 5));
    expect(result).to.deep.equal([1, 2, 3, 4, 5]);
  });

  it("should emit single number", async () => {
    const result = await toArray(range(10, 1));
    expect(result).to.deep.equal([10]);
  });

  it("should emit empty sequence", async () => {
    const result = await toArray(range(5, 0));
    expect(result).to.deep.equal([]);
  });

  it("should work with zero start", async () => {
    const result = await toArray(range(0, 3));
    expect(result).to.deep.equal([0, 1, 2]);
  });

  it("should throw error for negative count", () => {
    expect(() => range(0, -1)).to.throw("Count must be non-negative");
  });
});
