import { expect } from "chai";
import { sleep } from "../../src/utils/sleep.js";
import { toArray, from, pipe,  buffer, take, debounceTime, tap, timeout } from '../../src/index.js';


describe("timeout", () => {
  it("will consume original stream if time between chunks less-than duration", async () => {
    let input =  async function*(){yield 1, yield 2, await sleep(50), yield 3};
    let expected = await toArray(from(input));
    let result = await toArray(pipe(from(input), timeout(100)));
    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })  

  it("will error if time between chunks exceeds duration", async () => {
    let input = async function*(){yield 1, yield 2, await sleep(150), yield 3};
    let error = null;
    let result = null;
    try {
       result = await toArray(pipe(from(input), timeout(100)));
    } catch (err) {
      error = err;
    }
    expect(error).to.not.be.null;
    expect(result).to.be.null;
    expect(error).to.be.eq("timeout");
  })
});
