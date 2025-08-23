import { expect } from "chai";
import { toArray, concat, pipe, tap, from, through, of } from '../../src/index.js';
import { sleep } from "../../src/utils/sleep.js";

describe("streams", () => {
  it("writable can buffer until read from using watermark", async () => {
    let inputA = [1, 2, 3, 4, 5, 6, 7, 8];

    // 4 will be read - but the writer will block trying to write the 4th

    let buffer = new TransformStream<number>({}, { highWaterMark: 3 });
    let pulled: number[] = [];

    let source = pipe(from(inputA), tap(x => pulled.push(x)), {highWaterMark: 1});

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

      let source = pipe(from(input), tap(x => pulled.push(x)), {highWaterMark: 1});

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

  it("read me examples native", async () => {

    if (Symbol.asyncIterator && Symbol.asyncIterator in new ReadableStream()) {
      // 1) Async iteration over `of` should yield values in order
      const iterResult: string[] = [];
      for await (const v of of('a', 'b', 'c')) {
        iterResult.push(v);
      }
      expect(iterResult).to.deep.eq(['a', 'b', 'c']);
    }

    // 2) pipeTo -> writable: collect written chunks
    const written: any[] = [];
    const writable = new WritableStream({
      write(chunk) { written.push(chunk); }
    });

    await from(['a', 'b', 'c']).pipeTo(writable);
    // Wait microtask to ensure pipeline settled
    await new Promise(r => setTimeout(r, 0));
    expect(written).to.deep.eq(['a', 'b', 'c']);

    // 3) pipeThrough with TransformStream and pipeTo to writable: transform values
    const transformed: number[] = [];
    const numWritable = new WritableStream<number>({
      write(chunk) { transformed.push(chunk); }
    });

    await of(1, 2, 3)
      .pipeThrough(new TransformStream<number, number>({
        transform(value, controller) {
          controller.enqueue(value * 2);
        }
      }))
      .pipeTo(numWritable);

    await new Promise(r => setTimeout(r, 0));
    expect(transformed).to.deep.eq([2, 4, 6]);
  })
})