import { describe, it } from "mocha";
import { expect } from "chai";
import { from, pipe, toArray, ignoreElements } from "../../src/index.js";

describe("ignoreElements", () => {
  it("should ignore all values but preserve completion", async () => {
    const result = await toArray(pipe(
      from([1, 2, 3, 4, 5]),
      ignoreElements()
    ));
    expect(result).to.deep.equal([]);
  });

  it("should handle empty stream", async () => {
    const result = await toArray(pipe(
      from([]),
      ignoreElements()
    ));
    expect(result).to.deep.equal([]);
  });
});
