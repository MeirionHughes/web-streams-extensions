import { expect } from "chai";
import { toArray, concat, filter, from, zip, buffer } from '../src/index.js';

describe("steams", () => {
  it("can concat streams", async () => {
    let inputA = [1, 2, 3, 4];
    let inputB = [5, 6, 7, 8];
    let expected = inputA.concat(inputB);
    let result = await toArray(concat(
      new ReadableStream({
        start(controller) {
          for (let item of inputA) {
            controller.enqueue(item);
          }
          controller.close();
        }
      }),
      new ReadableStream({
        start(controller) {
          for (let item of inputB) {
            controller.enqueue(item);
          }
          controller.close();
        }
      })
    ));

    expect(result, "concat result matches expected").to.be.deep.eq(expected);
  })
})