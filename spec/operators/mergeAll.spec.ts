import { expect } from "chai";
import { from, pipe, toArray, mergeAll } from "../../src/index.js";

describe("mergeAll", () => {
  it("should flatten streams concurrently", async () => {
    const result = await toArray(pipe(
      from([
        from([1, 2]),
        from([3, 4])
      ]),
      mergeAll()
    ));
    expect(result.sort()).to.deep.equal([1, 2, 3, 4]);
  });
});
