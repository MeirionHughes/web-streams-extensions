import { expect } from "chai";
import { toArray, from, pipe,  buffer } from '../../src/index.js';

describe("buffer", () => {
  it("can buffer T ", async () => {
    let inputA = [1, 2, 3, 4, 5];
    let expected = [[1,2],[3,4],[5]]

    let result = await toArray(
      pipe(
        from(inputA),
        buffer(2))
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })
});
