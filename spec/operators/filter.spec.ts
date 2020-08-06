import { expect } from "chai";
import { toArray, from, map, pipe, filter } from '../../src';

describe("filter", () => {
  it("can filter T", async () => {
    let inputA = [1, 2, 3, 4];
    let expected = inputA.filter(x=>x>1 && x<4)

    let result = await toArray(
      pipe(
        from(inputA),
        filter(x =>x>1 && x<4))
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })    
  
  it("can filter with function predicate", async () => {
    let inputA = [
      {type: "foo", value: 1},
      {type: "bar", value: 2},
      {type: "foo", value: 3}];

    interface IFoo { type: "foo", value: number };

    let predicate = function(obj: object): obj is IFoo{
      return obj["type"] == "foo";
    }

    let expected = inputA.filter(predicate)

    let result = await toArray(
      pipe(
        from(inputA),
        filter(predicate))
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })
});

