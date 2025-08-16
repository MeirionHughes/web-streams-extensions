import { expect } from "chai";
import { empty, toArray } from "../src/index.js";


describe("empty", () => {
  it("should complete immediately without emitting values", async () => {
    const result = await toArray(empty());
    expect(result).to.deep.equal([]);
  });

  it("should work with typed empty", async () => {
    const result = await toArray(empty<number>());
    expect(result).to.deep.equal([]);
  });
});
