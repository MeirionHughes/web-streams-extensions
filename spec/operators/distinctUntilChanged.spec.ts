import { expect } from "chai";
import { distinctUntilChanged, from, pipe, toArray } from "../../src/index.js";

describe("distinctUntilChanged", () => {
  it("should filter out consecutive duplicates", async () => {
    const input = [1, 1, 2, 2, 2, 3, 3, 1, 1];
    const expected = [1, 2, 3, 1];
    
    const result = await toArray(pipe(
      from(input),
      distinctUntilChanged()
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should use custom comparison function", async () => {
    const input = [
      { id: 1, name: "a" },
      { id: 1, name: "b" }, // Same id, should be filtered
      { id: 2, name: "c" },
      { id: 2, name: "d" }, // Same id, should be filtered
      { id: 1, name: "e" }  // Different id, should pass
    ];
    
    const expected = [
      { id: 1, name: "a" },
      { id: 2, name: "c" },
      { id: 1, name: "e" }
    ];
    
    const result = await toArray(pipe(
      from(input),
      distinctUntilChanged((a, b) => a.id === b.id)
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should emit first value even if undefined", async () => {
    const input = [undefined, undefined, 1, 1, 2];
    const expected = [undefined, 1, 2];
    
    const result = await toArray(pipe(
      from(input),
      distinctUntilChanged()
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should handle empty stream", async () => {
    const result = await toArray(pipe(
      from([]),
      distinctUntilChanged()
    ));
    
    expect(result).to.deep.equal([]);
  });
});
