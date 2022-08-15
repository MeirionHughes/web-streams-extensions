import { expect } from "chai";
import { toArray, from, map, pipe, schedule } from '../../src';
import { IScheduler } from "../../src";

describe("schedule", () => {
  it("calls scheduler per streamed chunk", async () => {
    let inputA = [1, 2, 3, 4];
    let expected = inputA;
    let wasCalled = 0;

    let mockScheduler: IScheduler = {
      nextTick: async ()=>{wasCalled++;}
    }

    let result = await toArray(
      pipe(
        from(inputA),
        schedule(mockScheduler)
      )
    );

    expect(wasCalled, "scheduler was called x-times").to.be.deep.eq(expected.length);
  })
});
