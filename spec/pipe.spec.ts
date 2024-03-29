import { expect } from "chai";
import { Subject } from "../src/index.js";
import { toArray, from, pipe, filter, buffer, map, first, toPromise } from '../src/index.js';

describe("pipe", () => {
  it("can pipe multiple operators", async () => {
    let inputA = [1, 2, 3, 4];

    let expected = { "1": 1, "2": 2, "4": 4 };

    let result = await toPromise(
      pipe(
        from(inputA),
        filter(x => x != 3),
        buffer(Infinity),
        map(x => {
          return x.reduce((p, c) => { p[c.toString()] = c; return p }, {});
        }),
        first()
      ));

    expect(result, "from stream result matches expected").to.be.deep.eq(expected);
  })

  it("can pipe from readable-like sources (subject)", async () => {
    let inputA = [1, 2, 3, 4];

    let mapper = (x: number) => x * 10;
    let expected = inputA.slice().map(mapper)

    let src = new Subject<number>();

    let resultPromise = toArray(
      pipe(
        src,
        map(mapper)
      ));

    from(inputA).pipeTo(src.writable);

    let result = await resultPromise;

    expect(result, "from stream result matches expected").to.be.deep.eq(expected);
  })

  it("can pipe transformer", async () => {
    let inputA = [1, 2, 3, 4];

    let expected = [1, 2, 4];

    let filter = new TransformStream<number, number>({
      transform(chunk, controller) {
        if (chunk != 3) {
          controller.enqueue(chunk);
        }
      }
    })

    let result = await toArray(
      pipe(
        from(inputA),
        filter
      ));

    expect(result, "from stream result matches expected").to.be.deep.eq(expected);
  })

  it("cancelled reader reason propagates ", async () => {
    let inputA = [1, 2, 3, 4];

    let expected = 'foo';
    let result = null;


    let src = pipe(
      new ReadableStream({
        cancel(reason) {
          result = reason;
        }
      }),
      filter(x => x != 3),
      buffer(Infinity),
      map(x => {
        return x.reduce((p, c) => { p[c.toString()] = c; return p }, {});
      }),
      first()
    );

    let reader = src.getReader();

    reader.cancel(expected);

    expect(result, "cancel reason was propagated").to.be.deep.eq(expected);
  })

})