import { expect } from "chai";
import { toArray, from, toPromise } from '../src';

describe("to-promise", () => {
  it("can await a stream and take the last element", async () => {
    let inputA = [1, 2, 3, 4];
    let expected = 4;

    let result = await toPromise(from(inputA));

    expect(result, "from stream result matches expected").to.be.deep.eq(expected);
  })  
  
  it("can throw errors", async () => {
    let inputA = [1, 2, 3, 4];
    let src = async function*(){ yield 1; yield 2; throw "foo" };
    let expected = 4;

    let result = null;
    try{
      await toPromise(from(src()));
    }catch(err){
      result = err;
    }
    expect(result, "from stream result matches expected").to.be.eq('foo');
  })
})