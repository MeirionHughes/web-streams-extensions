import { expect } from "chai";
import { from, pipe, toArray, skipWhile } from "../../src/index.js";

describe("skipWhile", () => {
  it("should skip while predicate is true", async () => {
    const result = await toArray(pipe(
      from([1, 2, 3, 2, 4, 1, 5]),
      skipWhile(x => x < 3)
    ));
    expect(result).to.deep.equal([3, 2, 4, 1, 5]);
  });

  it("should handle empty stream", async () => {
    const result = await toArray(pipe(
      from([]),
      skipWhile(x => x < 3)
    ));
    expect(result).to.deep.equal([]);
  });
});
