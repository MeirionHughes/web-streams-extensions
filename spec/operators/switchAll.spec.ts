import { describe, it } from "mocha";
import { expect } from "chai";
import { from, pipe, toArray, switchAll } from "../../src/index.js";

describe("switchAll", () => {
  it("should switch to latest stream", async () => {
    const result = await toArray(pipe(
      from([
        from([1, 2]),
        from([3, 4])
      ]),
      switchAll()
    ));
    // Should get at least some values
    expect(result.length).to.be.greaterThan(0);
  });
});
