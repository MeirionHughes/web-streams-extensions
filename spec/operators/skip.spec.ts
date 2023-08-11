import { expect } from "chai";
import { toArray, from, pipe, skip } from '../../src/index.js';

describe("skip", () => {
  it("can skip less than total ", async () => {
    let inputA = [1, 2, 3, 4, 5];
    let expected = [4, 5]

    let result = await toArray(
      pipe(
        from(inputA),
        skip(3))
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })

  it("can skip more than total ", async () => {
    let inputA = [1, 2, 3, 4, 5];
    let expected = []

    let result = await toArray(
      pipe(
        from(inputA),
        skip(10))
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })
  it("can skip none", async () => {
    let inputA = [1, 2, 3, 4, 5];
    let expected = [1, 2, 3, 4, 5]

    let result = await toArray(
      pipe(
        from(inputA),
        skip(0))
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })
});
