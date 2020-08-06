import { expect } from "chai";
import { toArray, from } from '../src';

describe("from", () => {
  it("can create array from stream", async () => {
    let inputA = [1, 2, 3, 4];
    let expected = inputA.slice();

    let result = await toArray(from(inputA));

    expect(result, "from stream result matches expected").to.be.deep.eq(expected);
  })
})