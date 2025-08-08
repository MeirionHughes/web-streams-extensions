import { describe, it } from "mocha";
import { expect } from "chai";
import { from, pipe, toArray, pairwise } from "../../src/index.js";

describe("pairwise", () => {
  it("should emit previous and current as pairs", async () => {
    const result = await toArray(pipe(
      from([1, 2, 3, 4, 5]),
      pairwise()
    ));
    expect(result).to.deep.equal([[1, 2], [2, 3], [3, 4], [4, 5]]);
  });

  it("should handle empty stream", async () => {
    const result = await toArray(pipe(
      from([]),
      pairwise()
    ));
    expect(result).to.deep.equal([]);
  });

  it("should handle single value", async () => {
    const result = await toArray(pipe(
      from([1]),
      pairwise()
    ));
    expect(result).to.deep.equal([]);
  });
});
