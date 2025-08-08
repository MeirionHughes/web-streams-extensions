import { describe, it } from "mocha";
import { expect } from "chai";
import { from, pipe, toArray, delay } from "../../src/index.js";

describe("delay", () => {
  it("should delay emissions", async () => {
    const start = Date.now();
    const result = await toArray(pipe(
      from([1, 2, 3]),
      delay(50)
    ));
    const elapsed = Date.now() - start;
    
    expect(result).to.deep.equal([1, 2, 3]);
    expect(elapsed).to.be.greaterThanOrEqual(45);
  });

  it("should handle zero delay", async () => {
    const result = await toArray(pipe(
      from([1, 2, 3]),
      delay(0)
    ));
    expect(result).to.deep.equal([1, 2, 3]);
  });

  it("should throw error for negative delay", () => {
    expect(() => delay(-1)).to.throw("Delay duration must be non-negative");
  });
});
