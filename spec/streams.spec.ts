import { expect } from "chai";
import { toArray, concat, filter, from, zip, buffer } from '../src';

describe("steams", () => {
  it("can create stream from array", async () => {
    let inputA = [1, 2, 3, 4];
    let expected = inputA.slice();

    let result = await toArray(from(inputA));

    expect(result, "from stream result matches expected").to.be.deep.eq(expected);

  })

  it("can filter streams", async () => {
    let inputA = [1, 2, 3, 4];

    let expected = [2, 3]
    let result = await toArray(filter(
      new ReadableStream({
        start(controller) {
          for (let item of inputA) {
            controller.enqueue(item);
          }
          controller.close();
        }
      }),
      (chunk: number) => chunk >= 2 && chunk <= 3
    ));

    expect(result, "filter result matches expected").to.be.deep.eq(expected);

  })

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

  it("can zip streams of equal length", async () => {
    let inputA = [1, 2, 3, 4];
    let inputB = [5, 6, 7, 8];
    let inputC = [9, 10, 11, 12];
    let expected = [[1, 5, 9], [2, 6, 10], [3, 7, 11], [4, 8, 12]];
    let result = await toArray(zip([from(inputA), from(inputB), from(inputC)]));

    expect(result, "zip result matches expected").to.be.deep.eq(expected);
  })

  it("can zip streams of unequal length", async () => {
    let inputA = [1, 2, 3];
    let inputB = [5, 6, 7, 8];
    let inputC = [9, 10, 11, 12];
    let expected = [[1, 5, 9], [2, 6, 10], [3, 7, 11]];
    let result = await toArray(zip([from(inputA), from(inputB), from(inputC)]));

    expect(result, "zip result matches expected").to.be.deep.eq(expected);
  })

  it("can buffer streams of elements into stream of arrays", async () => {
    let input = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    let expected = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];

    let result = await toArray(from(input).pipeThrough(buffer(3)));

    expect(result, "buffer result matches expected").to.be.deep.eq(expected);
  })

  it("can buffer streams of elements and flush remainder", async () => {
    let input = [1, 2, 3, 4, 5, 6, 7, 8];
    let expected = [[1, 2, 3], [4, 5, 6], [7, 8]];

    let result = await toArray(from(input).pipeThrough(buffer(3)));

    expect(result, "buffer result matches expected").to.be.deep.eq(expected);
  })
})