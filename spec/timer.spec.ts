import { describe, it } from "mocha";
import { expect } from "chai";
import { timer, toArray, pipe, take } from "../src/index.js";

describe("timer", () => {
  it("should emit single value after delay", async () => {
    const start = Date.now();
    const result = await toArray(timer(50));
    const elapsed = Date.now() - start;
    
    expect(result).to.deep.equal([0]);
    expect(elapsed).to.be.greaterThanOrEqual(45); // Allow some timing variance
  });

  it("should emit incremental values with interval", async () => {
    const result = await toArray(pipe(timer(10, 20), take(3)));
    expect(result).to.deep.equal([0, 1, 2]);
  });

  it("should throw error for negative due time", () => {
    expect(() => timer(-1)).to.throw("Due time must be non-negative");
  });

  it("should throw error for negative interval", () => {
    expect(() => timer(0, -1)).to.throw("Interval duration must be positive");
  });
});
