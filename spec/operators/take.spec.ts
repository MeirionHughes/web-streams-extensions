import { expect } from "chai";
import { toArray, from, pipe, buffer, take } from '../../src';

describe("take", () => {
  it("can take less than input ", async () => {
    let inputA = [1, 2, 3, 4, 5];
    let expected = [1, 2, 3]

    let result = await toArray(
      pipe(
        from(inputA),
        take(3))
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })

  it("can take more than input ", async () => {
    let inputA = [1, 2, 3, 4];
    let expected = [1, 2, 3, 4]

    let result = await toArray(
      pipe(
        from(inputA),
        take(10))
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  }) 
  
  it("can take none ", async () => {
    let inputA = [1, 2, 3, 4];
    let expected = []

    let result = await toArray(
      pipe(
        from(inputA),
        take(0))
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })
});
