import { expect } from "chai";
import { toArray, from, defer } from '../src';

describe("defer", () => {
  it("can defer stream behind promise", async () => {
    let inputA = [1, 2, 3, 4];
    let expected = inputA;

    let result = await toArray(
      defer(
        ()=>Promise.resolve(from(inputA))
      )
    )

    expect(result, "concat result matches expected").to.be.deep.eq(expected);
  })
})