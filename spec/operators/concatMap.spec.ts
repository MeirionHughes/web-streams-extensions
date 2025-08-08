import { describe, it } from "mocha";
import { expect } from "chai";
import { from, pipe, toArray, concatMap } from "../../src/index.js";

describe("concatMap", () => {
  it("should map values to streams and concatenate sequentially", async () => {
    const result = await toArray(pipe(
      from([1, 2, 3]),
      concatMap(n => from([n, n * 10]))
    ));
    expect(result).to.deep.equal([1, 10, 2, 20, 3, 30]);
  });

  it("should work with promises", async () => {
    const result = await toArray(pipe(
      from([1, 2]),
      concatMap(n => Promise.resolve(n * 2))
    ));
    expect(result).to.deep.equal([2, 4]);
  });

  it("should work with arrays", async () => {
    const result = await toArray(pipe(
      from(['a', 'b']),
      concatMap(letter => [letter, letter.toUpperCase()])
    ));
    expect(result).to.deep.equal(['a', 'A', 'b', 'B']);
  });
});
