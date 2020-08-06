import { expect } from "chai";
import { toArray, concat, filter, from, zip, buffer } from '../src';

describe("steams", () => {
  it("can zip streams of equal length", async () => {
    let inputA = [1, 2, 3, 4];
    let inputB = [5, 6, 7, 8];
    let inputC = [9, 10, 11, 12];
    let expected = [[1, 5, 9], [2, 6, 10], [3, 7, 11], [4, 8, 12]];
    let result = await toArray(zip([from(inputA), from(inputB), from(inputC)]));

    expect(result, "zip result matches expected").to.be.deep.eq(expected);
  })

  it("can zip streams of unequal length", async () => {
    let inputA = [1, 2, 3];
    let inputB = [5, 6, 7, 8];
    let inputC = [9, 10, 11, 12];
    let expected = [[1, 5, 9], [2, 6, 10], [3, 7, 11]];
    let result = await toArray(zip([from(inputA), from(inputB), from(inputC)]));

    expect(result, "zip result matches expected").to.be.deep.eq(expected);
  })
})