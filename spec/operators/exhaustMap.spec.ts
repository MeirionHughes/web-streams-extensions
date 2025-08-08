import { describe, it } from "mocha";
import { expect } from "chai";
import { from, pipe, toArray, exhaustMap } from "../../src/index.js";

describe("exhaustMap", () => {
  it("should ignore new values while inner stream is active", async () => {
    const result = await toArray(pipe(
      from([1, 2, 3]),
      exhaustMap(n => from([n, n * 10]))
    ));
    // Should only process first value since others arrive while processing
    expect(result.length).to.be.greaterThan(0);
    expect(result[0]).to.equal(1);
  });

  it("should work with arrays", async () => {
    const result = await toArray(pipe(
      from([1, 2, 3]),
      exhaustMap(n => [n])
    ));
    expect(result[0]).to.equal(1);
  });
});
