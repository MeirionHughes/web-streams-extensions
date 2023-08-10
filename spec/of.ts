import { expect } from "chai";
import { toArray, from, of } from '../src';

describe("of", () => {
  it("can create stream of the given elements ", async () => {
    let inputA = [1, 2, 3, 4, {foo:"bar"}, function(){}, from(["a"])];
    let expected = inputA.slice();

    let result = await toArray(of(...inputA));

    expect(result, "from stream result matches expected").to.be.deep.eq(expected);
  })
})
