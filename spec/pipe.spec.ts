import { expect } from "chai";
import { toArray, from, pipe, filter, buffer, map, first, toPromise } from '../src';

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
})