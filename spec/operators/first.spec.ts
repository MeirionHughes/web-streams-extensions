import { expect } from "chai";
import { toArray, from, map, pipe, filter, first } from '../../src/index.js';

describe("first", () => {
  it("can get the first element of stream ", async () => {
    let inputA = [1, 2, 3, 4];
    let expected = [1]

    let result = await toArray(
      pipe(
        from(inputA),
        first())
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })
});
