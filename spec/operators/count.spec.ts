import { describe, it } from "mocha";
import { expect } from "chai";
import { from, pipe, toArray, count } from "../../src/index.js";

describe("count", () => {
  it("should count all values", async () => {
    const result = await toArray(pipe(
      from([1, 2, 3, 4, 5]),
      count()
    ));
    expect(result).to.deep.equal([5]);
  });

  it("should count with predicate", async () => {
    const result = await toArray(pipe(
      from([1, 2, 3, 4, 5]),
      count(x => x % 2 === 0)
    ));
    expect(result).to.deep.equal([2]); // 2 and 4
  });

  it("should handle empty stream", async () => {
    const result = await toArray(pipe(
      from([]),
      count()
    ));
    expect(result).to.deep.equal([0]);
  });
});
