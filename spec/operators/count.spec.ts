import { describe, it } from "mocha";
import { expect } from "chai";
import { from, pipe, toArray, count, throwError, empty } from "../../src/index.js";

describe("count", () => {
  it("should count all values", async () => {
    const result = await toArray(pipe(
      from([1, 2, 3, 4, 5]),
      count()
    ));
    expect(result).to.deep.equal([5]);
  });

  it("should count with predicate", async () => {
    const result = await toArray(pipe(
      from([1, 2, 3, 4, 5]),
      count(x => x % 2 === 0)
    ));
    expect(result).to.deep.equal([2]); // 2 and 4
  });

  it("should handle empty stream", async () => {
    const result = await toArray(pipe(
      from([]),
      count()
    ));
    expect(result).to.deep.equal([0]);
  });

  it("should handle empty stream with predicate", async () => {
    const result = await toArray(pipe(
      from([]),
      count(x => x > 0)
    ));
    expect(result).to.deep.equal([0]);
  });

  it("should count single value", async () => {
    const result = await toArray(pipe(
      from([42]),
      count()
    ));
    expect(result).to.deep.equal([1]);
  });

  it("should count with predicate that matches no values", async () => {
    const result = await toArray(pipe(
      from([1, 3, 5, 7]),
      count(x => x % 2 === 0)
    ));
    expect(result).to.deep.equal([0]);
  });

  it("should count with predicate that matches all values", async () => {
    const result = await toArray(pipe(
      from([2, 4, 6, 8]),
      count(x => x % 2 === 0)
    ));
    expect(result).to.deep.equal([4]);
  });

  it("should pass index to predicate", async () => {
    let indices: number[] = [];
    const result = await toArray(pipe(
      from(['a', 'b', 'c', 'd']),
      count((value, index) => {
        indices.push(index);
        return index % 2 === 0; // Count values at even indices
      })
    ));
    expect(result).to.deep.equal([2]); // 'a' at index 0, 'c' at index 2
    expect(indices).to.deep.equal([0, 1, 2, 3]);
  });

  it("should handle complex predicate", async () => {
    const data = [
      { name: 'Alice', age: 25 },
      { name: 'Bob', age: 17 },
      { name: 'Charlie', age: 30 },
      { name: 'David', age: 16 }
    ];
    
    const result = await toArray(pipe(
      from(data),
      count(person => person.age >= 18)
    ));
    expect(result).to.deep.equal([2]); // Alice and Charlie
  });

  it("should handle stream errors", async () => {
    try {
      await toArray(pipe(
        throwError(new Error("Test error")),
        count()
      ));
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.equal("Test error");
    }
  });

  it("should handle predicate errors", async () => {
    try {
      await toArray(pipe(
        from([1, 2, 3]),
        count((value) => {
          if (value === 2) throw new Error("Predicate error");
          return true;
        })
      ));
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.equal("Predicate error");
    }
  });

  it("should work with custom highWaterMark", async () => {
    const result = await toArray(
      count()(from([1, 2, 3, 4, 5]), { highWaterMark: 1 })
    );
    expect(result).to.deep.equal([5]);
  });

  it("should use default highWaterMark when not specified", async () => {
    const result = await toArray(
      count()(from([1, 2, 3]))
    );
    expect(result).to.deep.equal([3]);
  });

  it("should handle cancellation", async () => {
    const stream = count()(from([1, 2, 3, 4, 5]));
    const reader = stream.getReader();
    
    // Cancel before reading
    await reader.cancel("Test cancellation");
    reader.releaseLock();
  });

  it("should handle different data types", async () => {
    const result = await toArray(pipe(
      from([true, false, true, true, false]),
      count(x => x === true)
    ));
    expect(result).to.deep.equal([3]);
  });

  it("should handle null and undefined values", async () => {
    const result = await toArray(pipe(
      from([null, undefined, 1, null, 2, undefined]),
      count(x => x != null)
    ));
    expect(result).to.deep.equal([2]); // 1 and 2
  });

  it("should handle very large streams", async () => {
    async function* largeGenerator() {
      for (let i = 0; i < 10000; i++) {
        yield i;
      }
    }

    const result = await toArray(pipe(
      from(largeGenerator()),
      count(x => x % 1000 === 0)
    ));
    expect(result).to.deep.equal([10]); // 0, 1000, 2000, ..., 9000
  });

  it("should work with async streams", async () => {
    async function* asyncGenerator() {
      for (let i = 1; i <= 5; i++) {
        yield i;
      }
    }

    const result = await toArray(pipe(
      from(asyncGenerator()),
      count(x => x > 3)
    ));
    expect(result).to.deep.equal([2]); // 4 and 5
  });

  it("should count zero occurrences correctly", async () => {
    const result = await toArray(pipe(
      from([1, 1, 1, 1]),
      count(x => x === 2)
    ));
    expect(result).to.deep.equal([0]);
  });

  it("should handle string values", async () => {
    const result = await toArray(pipe(
      from(['apple', 'banana', 'cherry', 'apricot']),
      count(fruit => fruit.startsWith('a'))
    ));
    expect(result).to.deep.equal([2]); // apple and apricot
  });

  it("should maintain accurate index count with predicate", async () => {
    let lastIndex = -1;
    const result = await toArray(pipe(
      from([10, 20, 30, 40, 50]),
      count((value, index) => {
        expect(index).to.equal(lastIndex + 1);
        lastIndex = index;
        return value >= 30;
      })
    ));
    expect(result).to.deep.equal([3]); // 30, 40, 50
    expect(lastIndex).to.equal(4); // Last index should be 4
  });
});
