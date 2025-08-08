import { describe, it } from "mocha";
import { expect } from "chai";
import { race, from, toArray, timer, pipe, take, throwError } from "../src/index.js";

describe("race", () => {
  it("should emit from first source to emit", async () => {
    const fast = from([1, 2, 3]);
    const slow = timer(100);
    
    const result = await toArray(pipe(
      race(fast, slow),
      take(2)
    ));
    
    expect(result).to.deep.equal([1, 2]);
  });

  it("should handle errors from winner", async () => {
    const errorStream = throwError(new Error("Test error"));
    const normalStream = timer(100);
    
    try {
      await toArray(race(errorStream, normalStream));
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.equal("Test error");
    }
  });

  it("should throw error for empty sources", () => {
    expect(() => race()).to.throw("race requires at least one source stream");
  });
});
