import { expect } from "chai";
import { from, pipe, startWith, toArray } from "../../src/index.js";


describe("startWith", () => {
  it("should prepend single value", async () => {
    const input = [2, 3, 4];
    const expected = [1, 2, 3, 4];
    
    const result = await toArray(pipe(
      from(input),
      startWith(1)
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should prepend multiple values", async () => {
    const input = [4, 5];
    const expected = [1, 2, 3, 4, 5];
    
    const result = await toArray(pipe(
      from(input),
      startWith(1, 2, 3)
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should work with empty source", async () => {
    const expected = [1, 2, 3];
    
    const result = await toArray(pipe(
      from([]),
      startWith(1, 2, 3)
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should work with no starting values", async () => {
    const input = [1, 2, 3];
    const expected = [1, 2, 3];
    
    const result = await toArray(pipe(
      from(input),
      startWith()
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should handle different types", async () => {
    const input = ["world"];
    const expected = ["hello", "world"];
    
    const result = await toArray(pipe(
      from(input),
      startWith("hello")
    ));
    
    expect(result).to.deep.equal(expected);
  });
});
