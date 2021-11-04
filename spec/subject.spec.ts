import { expect } from "chai";
import { toArray, pipe, map, take, toPromise, from, tap } from '../src';
import { Subject } from "../src/subject";

describe("subject", () => {
  it("can observe with multiple readers - manual write", async () => {
    let input = [1, 2, 3, 4];
    let expected1 = input.slice();
    let expected2 = input.map(x => x * 2);
    let expected3 = input[0];

    let subject = new Subject<number>();

    let resultPromise1 = toArray(subject.readable);
    let resultPromise2 = toArray(pipe(subject.readable, map(x => x * 2)));
    let resultPromise3 = toPromise(pipe(subject.readable, take(1)));

    subject.next(1);
    subject.next(2);
    subject.next(3);
    subject.next(4);
    subject.complete();

    let result1 = await resultPromise1;
    let result2 = await resultPromise2;
    let result3 = await resultPromise3;

    expect(result1).to.be.deep.eq(expected1);
    expect(result2).to.be.deep.eq(expected2);
    expect(result3).to.be.deep.eq(expected3);
  })

  it("can observe with multiple readers - ending one doesn't affect other", async () => {
    let input = [1, 2, 3, 4];
    let expected1 = input.slice();
    let expected2 = input.slice(0, 2);

    let sub = new Subject<number>();

    let resultPromise1 = toArray(sub);
    let resultPromise2 = toArray(pipe(sub.readable, take(2)));

    for (let item of input) {
      await sub.next(item);
    }
    await sub.complete();

    let result1 = await resultPromise1;
    let result2 = await resultPromise2;


    expect(result1).to.be.deep.eq(expected1);
    expect(result2).to.be.deep.eq(expected2);
  })

  it("can observe with multiple readers - cancelling one does not cancel subject", async () => {
    let input = [1, 2, 3, 4];
    let expected1 = input.slice();
    let expected2 = input.slice(0, 2);

    let sub = new Subject<number>();

    let resultPromise1 = toArray(sub);
    
    let reader = sub.readable.getReader();

    reader.cancel('foo');

    for (let item of input) {
      await sub.next(item);
    }
    await sub.complete();

    let result1 = await resultPromise1;


    expect(result1).to.be.deep.eq(expected1);
  })

  it("completing a subject stops pipe through", async () => {
    let src = new Subject();
    let subject = new Subject();
    let pulled = [];

    pipe(src.readable).pipeTo(subject.writable);

    let outputTask = toArray(subject.readable);
    let outputTask2 = toArray(src.readable);

    await src.next(1);
    await subject.complete();
    await src.next(2);
    await src.complete();

    let result = await outputTask;
    let result2 = await outputTask2;

    expect(result).to.be.deep.eq([1]);
    expect(result2).to.be.deep.eq([1, 2]);
  })


  it("completing a writable completes subject", async () => {
    let subject = new Subject();

    pipe(from([1, 2, 3, 4])).pipeTo(subject.writable);

    let result = await toArray(subject.readable);

    expect(result).to.be.deep.eq([1, 2, 3, 4]);
  })

  it("erroring a writable errors the subscribers", async () => {
    let subject = new Subject();
    let result = null;

    pipe(new ReadableStream({
      start(controller) {
      },
      pull(controller) {
        controller.error("foo");
      }
    })).pipeTo(subject.writable);

    try {
      let result = await toArray(subject.readable);
    } catch (err) {
      result = err;
    }

    expect(result).to.be.eq('foo');
  })


  it("can pipeTo", async () => {
    let input = [1, 2, 3, 4];
    let expected1 = input.slice();
    let expected2 = input.map(x => x * 2);
    let expected3 = input[0];

    let subject = new Subject<number>();

    let resultPromise1 = toArray(subject.readable);
    let resultPromise2 = toArray(pipe(subject.readable, map(x => x * 2)));
    let resultPromise3 = toPromise(pipe(subject.readable, take(1)));

    from(input).pipeTo(subject.writable);

    let result1 = await resultPromise1;
    let result2 = await resultPromise2;
    let result3 = await resultPromise3;

    expect(result1).to.be.deep.eq(expected1);
    expect(result2).to.be.deep.eq(expected2);
    expect(result3).to.be.deep.eq(expected3);
  })

  it("can pipeThrough", async () => {
    let input = [1, 2, 3, 4];
    let expected = input.slice();

    let subject = new Subject<number>();

    let result = await toArray(from(input).pipeThrough(subject));

    expect(result).to.be.deep.eq(expected);
  })
})
