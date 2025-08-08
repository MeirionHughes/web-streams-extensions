import { describe, it } from "mocha";
import { expect } from "chai";
import { throwError, toArray } from "../src/index.js";

describe("throwError", () => {
  it("should error immediately with provided error", async () => {
    const testError = new Error("Test error");
    try {
      await toArray(throwError(testError));
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err).to.equal(testError);
    }
  });

  it("should error with factory function", async () => {
    let callCount = 0;
    const errorFactory = () => {
      callCount++;
      return new Error(`Error ${callCount}`);
    };
    
    try {
      await toArray(throwError(errorFactory));
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.equal("Error 1");
      expect(callCount).to.equal(1);
    }
  });
});
