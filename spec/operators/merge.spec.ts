import { expect } from "chai";
import { toArray, from, map, pipe, toPromise } from '../../src';
import { merge } from "../../src/operators/merge";
import { tap } from "../../src/operators/tap";
import { sleep } from "../../src/utils/sleep";

describe("merge", () => {
  it("can merge stream of promises, resolved", async () => {
    let input = [1, 2, 3, 4];
    let inputPromise = input.map(x => Promise.resolve(x));
    let expected = input.slice();

    let result = await toArray(
      pipe(
        from(inputPromise),
        merge())
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })
  it("can merge stream of promises, sorted by resolved time", async () => {
    let input = [
      sleep(40).then(_ => 1),
      sleep(20).then(_ => 2),
      sleep(30).then(_ => 3),
      sleep(10).then(_ => 4)
    ];
    let expected = [4, 2, 3, 1];

    let result = await toArray(
      pipe(
        from(input),
        merge())
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })

  it("can merge stream of streams", async () => {
    let sources = [
      pipe(from([1, 5, 10, 15]), map(async x => { await sleep(x); return x })),
      pipe(from([3, 8, 13, 19]), map(async x => { await sleep(x); return x }))
    ]
    let expected = [1, 3, 5, 8, 10, 13, 15, 19];

    let result = await toArray(
      pipe(
        from(sources),
        merge())
    );
    expect(result.length, "correct number of outputs").to.be.eq(expected.length);
    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })

  it("can merge streams, limited by concurrency", async () => {
    let sources = [
      pipe(from([1, 5, 10, 15]), map(async x => { await sleep(x); return x })),
      pipe(from([3, 8, 13, 19]), map(async x => { await sleep(x); return x }))
    ]
    let expected = [1, 5, 10, 15, 3, 8, 13, 19];

    let result = await toArray(
      pipe(
        from(sources),
        merge(1))
    );
    expect(result.length, "correct number of outputs").to.be.eq(expected.length);
    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })

  xit("will start reading from the first stream if next element is delayed", async () => {
    let result = [];
    let err = null;
    try {
      await toPromise(
        pipe(
          new ReadableStream({
            async start(controller) {
              controller.enqueue(from([1, 2, 3, 4]));
              await sleep(100);
              controller.error("foo");
            }
          }),
          merge(),
          tap(x => result.push(x)))
      );
    }
    catch (_err) {
      err = _err;
    }

    // if it can't pull elements from the main stream while also 
    // concurrently iterating through its current queue, then 
    // we wouldn't see the initial values [1,2,3,4] before 
    // seeing the error being thrown... 

    expect(err).to.be.eq("foo");
    expect(result, "stream result matches expected").to.be.deep.eq([1, 2, 3, 4]);
  })
});
