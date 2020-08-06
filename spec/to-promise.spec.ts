import { expect } from "chai";
import { toArray, from, toPromise } from '../src';

describe("from", () => {
  it("can await a stream and take the last element", async () => {
    let inputA = [1, 2, 3, 4];
    let expected = 4;

    let result = await toPromise(from(inputA));

    expect(result, "from stream result matches expected").to.be.deep.eq(expected);
  })
})