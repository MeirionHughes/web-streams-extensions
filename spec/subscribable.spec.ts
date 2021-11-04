import { expect } from "chai";
import { toArray, pipe, map, take, toPromise, from } from '../src';
import { Subject } from "../src/subject";
import { Subscribable } from "../src/_subscribable";

describe("subscribable", () => {
  it("disposing a subscriber doesn't end the whole subscribable ", async () => {
    let expected1 = [1, 2];
    let expected2 = [1, 2, 3, 4];
    let result1 = [];
    let result2 = [];

    let subscribable = new Subscribable<number>();

    let sub1 = subscribable.subscribe({
      next: (value: number) => { result1.push(value); return 1 },
      complete: () => { },
      error: () => { }
    });

    let sub2 = subscribable.subscribe({
      next: (value: number) => {  result2.push(value);  return 1 },
      complete: () => { },
      error: () => { }
    });

    await subscribable.next(1);
    await subscribable.next(2);

    sub1.unsubscribe();

    await subscribable.next(3);
    await subscribable.next(4);
    await subscribable.complete();

    expect(result1, "from stream result matches expected").to.be.deep.eq(expected1);    
    expect(result2, "from stream result matches expected").to.be.deep.eq(expected2);

    expect(sub1.closed, "sub1 is closed").to.be.eq(true);
    expect(sub2.closed, "sub2 is closed").to.be.eq(true);
  })
})
