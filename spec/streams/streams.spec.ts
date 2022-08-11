import { expect } from "chai";
import { toArray, concat, pipe, tap, from, through } from '../../src';
import { sleep } from "../../src/utils/sleep";

describe("streams", () => {
  it("writable can buffer until read from using watermark", async () => {
    let inputA = [1, 2, 3, 4, 5, 6, 7, 8];

    // 4 will be read - but the writer will block trying to write the 4th

    let buffer = new TransformStream<number>({}, { highWaterMark: 3 });
    let pulled: number[] = [];

    let source = pipe(from(inputA), tap(x => pulled.push(x)));

    source.pipeTo(buffer.writable);

    await sleep(10);

    let expected = [1, 2, 3, 4];
    let result = pulled.slice();

    let full = await toArray(buffer.readable); // drain the buffer to pull the remainder

    expect(result, "concat result matches expected").to.be.deep.eq(expected);
    expect(pulled, "concat result matches expected").to.be.deep.eq(inputA);
  }),

    it("writable can buffer from async generator until read from using watermark", async () => {
      let inputA = [1, 2, 3, 4, 5, 6, 7, 8];
      let input = async function* () {
        for (let item of inputA) {
          yield item;
        }
      }

      // 4 will be read - but the writer will block trying to write the 4th

      let buffer = new TransformStream<number>({}, { highWaterMark: 3 });
      let pulled: number[] = [];

      let source = pipe(from(input), tap(x => pulled.push(x)));

      source.pipeTo(buffer.writable);

      await sleep(10);

      let expected = [1, 2, 3, 4];
      let result = pulled.slice();

      let full = await toArray(buffer.readable); // drain the buffer to pull the remainder

      expect(result, "concat result matches expected").to.be.deep.eq(expected);
      expect(pulled, "concat result matches expected").to.be.deep.eq(inputA);
    }),

    it("will call pull on readable-stream", async () => {
      let inputA = [1, 2, 3, 4, 5, 6, 7, 8];
      let expected = inputA.map(x => x);

      let readable = new ReadableStream({
        async start(controller) {
          controller.enqueue(inputA.shift());
        },
        async pull(controller) {
          if (inputA.length == 0) {
            controller.close();
          }
          else {
            controller.enqueue(inputA.shift());
          }
        }
      })

      let result = await toArray(readable);

      expect(result).to.deep.eq(expected);
    })
})