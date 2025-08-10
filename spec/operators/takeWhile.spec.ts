import { expect } from "chai";
import { from, pipe, toArray, takeWhile } from "../../src/index.js";

describe("takeWhile", () => {
  it("should take while predicate is true", async () => {
    const result = await toArray(pipe(
      from([1, 2, 3, 4, 5]),
      takeWhile(x => x < 3)
    ));
    expect(result).to.deep.equal([1, 2]);
  });

  it("should handle empty stream", async () => {
    const result = await toArray(pipe(
      from([]),
      takeWhile(x => x < 3)
    ));
    expect(result).to.deep.equal([]);
  });
});
