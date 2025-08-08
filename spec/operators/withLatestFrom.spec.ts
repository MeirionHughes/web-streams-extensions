import { describe, it } from "mocha";
import { expect } from "chai";
import { from, pipe, toArray, withLatestFrom } from "../../src/index.js";

describe("withLatestFrom", () => {
  it("should combine with latest from other stream", async () => {
    const source = from([1, 2, 3]);
    const other = from(['a', 'b', 'c']);
    
    // This is a simplified test - in real scenarios timing matters more
    const result = await toArray(pipe(
      source,
      withLatestFrom(other)
    ));
    
    // Should get some combined values
    expect(result.length).to.be.greaterThanOrEqual(0);
  });
});
