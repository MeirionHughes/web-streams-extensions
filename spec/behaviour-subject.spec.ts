import { expect } from "chai";
import { BehaviorSubject } from "../src/behaviour_subject.js";
import { first } from "../src/operators/first.js";
import { pipe } from "../src/pipe.js";
import { toPromise } from "../src/to-promise.js";

describe("Behavior Subject", function () {
  it("gives initial value", async function () {
    let subject = new BehaviorSubject(13);

    let result = await toPromise(pipe(subject.readable, first()));

    expect(result).to.eq(13);
  })

  it("remembers last value", async function () {
    let subject = new BehaviorSubject(13);

    let input = [1,5,8,3];
    let expected = input[input.length - 1];

    for(let value of input){
      subject.next(value);
    }
    
    let result = await toPromise(pipe(subject.readable, first()));

    expect(result).to.eq(expected);
  })
});