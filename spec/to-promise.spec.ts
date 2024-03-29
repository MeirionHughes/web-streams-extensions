import { expect } from "chai";
import { toArray, from, toPromise } from '../src/index.js';

describe("to-promise", () => {
  it("can await a stream and take the last element", async () => {
    let inputA = [1, 2, 3, 4];
    let expected = 4;

    let result = await toPromise(from(inputA));

    expect(result, "from stream result matches expected").to.be.deep.eq(expected);
  })  
    
  it("can create promise from readable", async () => {
    let inputA = [1, 2, 3, 4];
    let expected = 4;

    let src = from(inputA);

    let transform = new TransformStream();

    let resultPromise = toPromise(transform);
    
    src.pipeTo(transform.writable);

    let result = await resultPromise;

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