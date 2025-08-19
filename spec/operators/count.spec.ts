import { expect } from "chai";
import { from, pipe, toArray, count, throwError, empty } from "../../src/index.js";
import { VirtualTimeScheduler } from '../../src/testing/virtual-tick-scheduler.js';


describe("count", () => {
  describe("Real Time", () => {
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

  describe("Virtual Time", () => {
    describe("Basic Behavior", () => {
      it("should handle empty stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('|');
          const result = pipe(stream, count());
          expectStream(result).toBe('(0|)', { 0: 0 });
        });
      });

      it("should count all values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcde|', { a: 1, b: 2, c: 3, d: 4, e: 5 });
          const result = pipe(stream, count());
          expectStream(result, { strict: false }).toBe('-----(5|)', { 5: 5 });
        });
      });

      it("should count single value", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a|', { a: 42 });
          const result = pipe(stream, count());
          expectStream(result, { strict: false }).toBe('-(1|)', { 1: 1 });
        });
      });

      it("should count with predicate", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcde|', { a: 1, b: 2, c: 3, d: 4, e: 5 });
          const result = pipe(stream, count((x: number) => x % 2 === 0));
          expectStream(result, { strict: false }).toBe('-----(2|)', { 2: 2 }); // 2 and 4
        });
      });

      it("should count with predicate matching none", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 1, b: 3, c: 5 });
          const result = pipe(stream, count((x: number) => x % 2 === 0));
          expectStream(result, { strict: false }).toBe('---(0|)', { 0: 0 });
        });
      });

      it("should count with predicate matching all", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 2, b: 4, c: 6 });
          const result = pipe(stream, count((x: number) => x % 2 === 0));
          expectStream(result, { strict: false }).toBe('---(3|)', { 3: 3 });
        });
      });
    });

    describe("Timing Patterns", () => {
      it("should wait for all values before emitting count", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-b-c-d|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, count());
          expectStream(result, { strict: false }).toBe('-------(4|)', { 4: 4 });
        });
      });

      it("should handle grouped emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('(abc)|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, count());
          expectStream(result, { strict: false }).toBe('-(3|)', { 3: 3 });
        });
      });

      it("should handle spaced timing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a---b---c|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, count());
          expectStream(result, { strict: false }).toBe('---------(3|)', { 3: 3 });
        });
      });

      it("should handle complex timing patterns", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('--a--(bc)---d|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, count());
          expectStream(result, { strict: false }).toBe('----------(4|)', { 4: 4 });
        });
      });

      it("should handle delayed completion", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc-----|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, count());
          expectStream(result, { strict: false }).toBe('--------(3|)', { 3: 3 });
        });
      });

      it("should count with predicate and complex timing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-b-(cd)-e-f|', { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
          const result = pipe(stream, count((x: number) => x % 2 === 0));
          expectStream(result, { strict: false }).toBe('---------(3|)', { 3: 3 }); // 2, 4, 6
        });
      });
    });

    describe("Error Handling", () => {
      it("should propagate source errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab#', { a: 1, b: 2 });
          const result = pipe(stream, count());
          expectStream(result).toBe('--#');
        });
      });

      it("should handle error before any values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('#');
          const result = pipe(stream, count());
          expectStream(result).toBe('#');
        });
      });

      it("should handle error after some values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-b-c-#', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, count());
          expectStream(result).toBe('------#');
        });
      });

      it("should handle predicate errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, count((x: number) => {
            if (x === 2) throw new Error('Predicate error');
            return x > 0;
          }));
          expectStream(result).toBe('-#', undefined, new Error('Predicate error'));
        });
      });

      it("should handle predicate error with timing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a--b--c|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, count((x: number) => {
            if (x === 2) throw new Error('Predicate error');
            return true;
          }));
          expectStream(result).toBe('---#', undefined, new Error('Predicate error'));
        });
      });
    });

    describe("Advanced Patterns", () => {
      it("should pass index to predicate correctly", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { a: 10, b: 20, c: 30, d: 40 });
          const result = pipe(stream, count((value: number, index: number) => index % 2 === 0));
          expectStream(result, { strict: false }).toBe('----(2|)', { 2: 2 }); // indices 0 and 2
        });
      });

      it("should handle complex predicate logic", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcde|', { 
            a: { name: 'Alice', age: 25 }, 
            b: { name: 'Bob', age: 17 }, 
            c: { name: 'Charlie', age: 30 }, 
            d: { name: 'David', age: 16 }, 
            e: { name: 'Eve', age: 28 } 
          });
          const result = pipe(stream, count((person: any) => person.age >= 18));
          expectStream(result, { strict: false }).toBe('-----(3|)', { 3: 3 }); // Alice, Charlie, Eve
        });
      });

      it("should handle different data types", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcde|', { a: true, b: false, c: true, d: true, e: false });
          const result = pipe(stream, count((x: boolean) => x === true));
          expectStream(result, { strict: false }).toBe('-----(3|)', { 3: 3 });
        });
      });

      it("should handle null and undefined values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcdef|', { 
            a: null, 
            b: undefined, 
            c: 1, 
            d: null, 
            e: 2, 
            f: undefined 
          });
          const result = pipe(stream, count((x: any) => x !== null && x !== undefined && x !== 'b' && x !== 'f'));
          expectStream(result, { strict: false }).toBe('------(2|)', { 2: 2 }); // 1 and 2 only
        });
      });

      it("should handle string matching", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { 
            a: 'apple', 
            b: 'banana', 
            c: 'cherry', 
            d: 'apricot' 
          });
          const result = pipe(stream, count((fruit: string) => fruit.startsWith('a')));
          expectStream(result, { strict: false }).toBe('----(2|)', { 2: 2 }); // apple and apricot
        });
      });
    });

    describe("Edge Cases", () => {
      it("should count zero when predicate matches nothing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { a: 1, b: 1, c: 1, d: 1 });
          const result = pipe(stream, count((x: number) => x === 2));
          expectStream(result, { strict: false }).toBe('----(0|)', { 0: 0 });
        });
      });

      it("should handle single value with predicate", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a|', { a: 42 });
          const result = pipe(stream, count((x: number) => x > 40));
          expectStream(result, { strict: false }).toBe('-(1|)', { 1: 1 });
        });
      });

      it("should handle single value with failing predicate", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a|', { a: 10 });
          const result = pipe(stream, count((x: number) => x > 40));
          expectStream(result, { strict: false }).toBe('-(0|)', { 0: 0 });
        });
      });

      it("should handle hot stream subscription pattern", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab^cde|', { a: 1, b: 2, c: 3, d: 4, e: 5 });
          const result = pipe(stream, count());
          expectStream(result, { strict: false }).toBe('---(3|)', { 3: 3 }); // Only c, d, e counted
        });
      });

      it("should handle very rapid emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('(abcdefghij)|', { 
            a: 1, b: 2, c: 3, d: 4, e: 5, 
            f: 6, g: 7, h: 8, i: 9, j: 10 
          });
          const result = pipe(stream, count());
          expectStream(result).toBe('-(x|)', { x: 10 });
        });
      });

      it("should handle alternating predicate matches", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcdefgh|', { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8 });
          const result = pipe(stream, count((x: number, index: number) => index % 2 === 0));
          expectStream(result, { strict: false }).toBe('--------(4|)', { 4: 4 }); // indices 0,2,4,6
        });
      });
    });
  });
});
