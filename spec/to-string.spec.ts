import { expect } from "chai";
import { from,toString } from '../src/index.js';

describe("toString", () => {
  it("can combine chunks into a string", async () => {
    let inputA = ["hello", " ", "world"];
    let expected = "hello world";

    let result = await toString(from(inputA));

    expect(result, "from stream result matches expected").to.be.deep.eq(expected);
  })
})