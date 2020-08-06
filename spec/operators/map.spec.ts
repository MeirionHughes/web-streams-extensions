import { expect } from "chai";
import { toArray, from, map, pipe } from '../../src';

describe("map", () => {
  it("can map T ", async () => {
    let inputA = [1, 2, 3, 4];
    let expected = inputA.slice().map(x => x * 2);

    let result = await toArray(
      pipe(
        from(inputA),
        map(x => x * 2))
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })
  it("can map T and ignore undefined ", async () => {
    let inputA = [1, 2, 3, 4];
    let expected = [2,4,6];

    let result = await toArray(
      pipe(
        from(inputA),
        map(x => x < 4 ? x * 2 : undefined))
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })
    
  it("can map T -> R ", async () => {
    let inputA = [1, 2, 3, 4];
    let expected = inputA.map(x=>x.toString());

    let result = await toArray(
      pipe(
        from(inputA),
        map(x => x.toString()))
    );

    expect(result, "stream result matches expected").to.be.deep.equal(expected);
  })
});
