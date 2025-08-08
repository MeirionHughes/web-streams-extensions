import { describe, it } from "mocha";
import { expect } from "chai";
import { combineLatest, from, toArray, pipe, take } from "../src/index.js";

describe("combineLatest", () => {
  it("should combine latest values from multiple streams", async () => {
    const result = await toArray(pipe(
      combineLatest(
        from([1, 2, 3]),
        from(['a', 'b', 'c'])
      ),
      take(3) // Take first few combinations
    ));
    
    expect(result.length).to.be.greaterThan(0);
    expect(result[0]).to.be.an('array');
    expect(result[0].length).to.equal(2);
  });

  it("should handle empty sources", () => {
    expect(() => combineLatest([])).to.throw("combineLatest requires at least one source stream");
  });

  it("should work with array format", async () => {
    const sources = [from([1, 2]), from([3, 4])];
    const result = await toArray(pipe(
      combineLatest(sources),
      take(2)
    ));
    
    expect(result.length).to.be.greaterThan(0);
  });
});
