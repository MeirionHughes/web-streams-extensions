import { expect } from "chai";
import { from, pipe, switchMap, toArray, Subject, map } from "../../src/index.js";

describe("switchMap", () => {
  it("should handle basic switchMap with completed streams", async () => {
    const input = [1, 2, 3];
    
    const result = await toArray(pipe(
      from(input),
      switchMap(x => from([x * 10]))
    ));
    
    // With completed input stream, last inner stream should emit
    expect(result).to.include(30);
  });

  it("should handle empty inner streams", async () => {
    const input = [1, 2, 3];
    
    const result = await toArray(pipe(
      from(input),
      switchMap(x => from([])) // Empty streams
    ));
    
    expect(result).to.deep.equal([]);
  });

  it("should handle errors in projection function", async () => {
    const input = [1, 2, 3];
    
    try {
      await toArray(pipe(
        from(input),
        switchMap(x => {
          if (x === 2) throw new Error("Projection error");
          return from([x * 10]);
        })
      ));
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.equal("Projection error");
    }
  });

  it("should pass index to projection function", async () => {
    const input = [10];
    
    const result = await toArray(pipe(
      from(input),
      switchMap((value, index) => from([value + index]))
    ));
    
    expect(result).to.deep.equal([10]);
  });

  it("should work with different types", async () => {
    const input = ['c'];
    
    const result = await toArray(pipe(
      from(input),
      switchMap(letter => from([letter.toUpperCase()]))
    ));
    
    expect(result).to.deep.equal(['C']);
  });

  it("should handle single value switching", async () => {
    const result = await toArray(pipe(
      from([1]),
      switchMap(x => from([x * 100])) // Fast inner streams
    ));
    
    expect(result).to.deep.equal([100]);
  });

  it("should handle simple async case", async () => {
    const subject = new Subject<number>();
    
    const resultPromise = toArray(pipe(
      subject.readable,
      switchMap(x => from([x * 100]))
    ));
    
    subject.next(1);
    subject.complete();
    
    const result = await resultPromise;
    expect(result).to.deep.equal([100]);
  });
});
