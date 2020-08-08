import { expect } from "chai";
import { toArray, from, pipe, buffer, concatAll } from '../../src';

describe("concat operator", () => {
  it("can concatenate stream of streams ", async () => {
    let input = [from([1, 2]), from([3, 4]), from([5])];
    let expected = [1, 2, 3, 4, 5]

    let result = await toArray(
      pipe(
        from(input),
        concatAll())
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })
});
