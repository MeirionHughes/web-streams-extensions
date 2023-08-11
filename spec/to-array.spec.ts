import { expect } from "chai";
import { toArray, from } from '../src/index.js';

describe("to-array", () => {
  it("can create array from stream", async () => {
    let inputA = [1, 2, 3, 4];
    let expected = inputA.slice();

    let result = await toArray(from(inputA));

    expect(result, "from stream result matches expected").to.be.deep.eq(expected);
  })

  it("can create array from readable", async () => {
    let inputA = [1, 2, 3, 4];
    let expected = inputA.slice();

    let src = from(inputA);

    let transform = new TransformStream();

    let resultPromise = toArray(transform);

    src.pipeTo(transform.writable);

    let result = await resultPromise;

    expect(result, "from stream result matches expected").to.be.deep.eq(expected);
  })

  it("can throw errors", async () => {
    let expected = "foo";
    let inputA = [1, 2, 3, 4];
    let src = async function* () { yield 1; yield 2; throw expected };

    let result = null;
    try {
      await toArray(from(src()));
    } catch (err) {
      result = err;
    }
    expect(result, "from stream result matches expected").to.be.eq(expected);
  })
})