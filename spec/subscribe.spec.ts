import { expect } from "chai";
import { toArray, from, Subject } from '../src/index.js';
import { subscribe } from "../src/subscribe.js";

describe("subscribe", () => {
  it("can subscribe and consume a stream", async () => {
    let inputA = [1, 2, 3, 4];

    let expected = inputA.slice();


    let result = await new Promise((complete, error) => {
      let tmp: number[] = [];
      let disposer = subscribe(from(inputA),
        (next) => { tmp.push(next) },
        () => complete(tmp),
        (err) => error(err));
    })

    expect(result, "from stream result matches expected").to.be.deep.eq(expected);
  })

  it("subscribe is closed when disposed", async () => {
    let inputA = [1, 2, 3, 4];

    let expected = inputA.slice();

    let src = new Subject();

    let sub = subscribe(src, (next) => {});

    sub.unsubscribe();



    expect(sub.closed, "from stream result matches expected").to.be.eq(true);
  })


  it("can subscribe and dispose before reading the whole stream", async () => {
    let inputA = [1, 2, 3, 4];
    let expected = [1, 2];

    let result = await new Promise((complete, error) => {
      let count = 0;
      let tmp: number[] = [];
      let sub = subscribe(from(inputA),
        (next) => { tmp.push(next); if (++count >= 2) { sub.unsubscribe() } },
        () => complete(tmp),
        (err) => error(err));
    })

    expect(result, "from stream result matches expected").to.be.deep.eq(expected);
  })

  it("can subscribe and catch error thrown from producer", async () => {
    let inputA = function* () { yield 1; yield 2; throw Error("Foo") }
    let result = null;

    try {
      await new Promise<void>((complete, error) => {
        subscribe(from(inputA),
          (next) => {},
          () => complete(),
          (err) => error(err));
      });
    } catch (err) {
      result = err;
    }

    expect(result).to.not.be.undefined;
    expect(result.message).to.be.eql("Foo");
  })
})