import { expect } from "chai";
import { toArray, pipe, map, take, toPromise, from } from '../src';
import { Subject } from "../src/subject";

describe("subject", () => {
  it("can observe with multiple readers - manual write", async () => {
    let input = [1, 2, 3, 4];
    let expected1 = input.slice();
    let expected2 = input.map(x=>x*2);
    let expected3 = input[0];

    let subject = new Subject<number>();

    let resultPromise1 = toArray(subject.readable);
    let resultPromise2 = toArray(pipe(subject.readable, map(x=>x*2)));
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
  
  it("can pipeTo", async () => {
    let input = [1, 2, 3, 4];
    let expected1 = input.slice();
    let expected2 = input.map(x=>x*2);
    let expected3 = input[0];

    let subject = new Subject<number>();

    let resultPromise1 = toArray(subject.readable);
    let resultPromise2 = toArray(pipe(subject.readable, map(x=>x*2)));
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
