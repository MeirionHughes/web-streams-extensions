import { describe, it } from "mocha";
import { expect } from "chai";
import { from, pipe, toArray, defaultIfEmpty } from "../../src/index.js";

describe("defaultIfEmpty", () => {
  it("should provide default for empty stream", async () => {
    const result = await toArray(pipe(
      from([]),
      defaultIfEmpty('default')
    ));
    expect(result).to.deep.equal(['default']);
  });

  it("should pass through non-empty stream", async () => {
    const result = await toArray(pipe(
      from([1, 2, 3]),
      defaultIfEmpty(0)
    ));
    expect(result).to.deep.equal([1, 2, 3]);
  });
});
