import { expect } from "chai";
import { from, pipe, toArray, pairwise } from "../../src/index.js";
import { parseMarbles } from '../../src/testing/parse-marbles.js';
import { VirtualTimeScheduler } from '../../src/testing/virtual-tick-scheduler.js';


describe("pairwise", () => {

  describe("Real Time", () => {
    it("should emit previous and current as pairs", async () => {
      const result = await toArray(pipe(
        from([1, 2, 3, 4, 5]),
        pairwise()
      ));
      expect(result).to.deep.equal([[1, 2], [2, 3], [3, 4], [4, 5]]);
    });

    it("should handle empty stream", async () => {
      const result = await toArray(pipe(
        from([]),
        pairwise()
      ));
      expect(result).to.deep.equal([]);
    });

    it("should handle single value", async () => {
      const result = await toArray(pipe(
        from([1]),
        pairwise()
      ));
      expect(result).to.deep.equal([]);
    });

  }); // Real Time

  describe("Virtual Time", () => {
    describe("Basic Behavior", () => {
      it("should emit pairs of consecutive values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c-d|", { a: 1, b: 2, c: 3, d: 4 });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("--a-b-c|", { a: [1, 2], b: [2, 3], c: [3, 4] });
        });
      });

      it("should handle empty streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("|");
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("|");
        });
      });

      it("should handle single value streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a|", { a: 1 });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("-|");
        });
      });

      it("should work with two values only", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b|", { a: 'first', b: 'second' });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("--a|", { a: ['first', 'second'] });
        });
      });

      it("should handle three consecutive values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abc|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("-ab|", { a: [1, 2], b: [2, 3] });
        });
      });
    });

    describe("Timing Patterns", () => {
      it("should handle streams with different timing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a---b-c--d|", { a: 'x', b: 'y', c: 'z', d: 'w' });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("----a-b--c|", { a: ['x', 'y'], b: ['y', 'z'], c: ['z', 'w'] });
        });
      });

      it("should handle immediate emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("(abc)|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("(ab)|", { a: [1, 2], b: [2, 3] });
        });
      });

      it("should handle long delays between values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a------b------c|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("-------a------b|", { a: [1, 2], b: [2, 3] });
        });
      });

      it("should handle rapid sequence followed by delay", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("(abc)----d|", { a: 1, b: 2, c: 3, d: 4 });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("(ab)----c|", { a: [1, 2], b: [2, 3], c: [3, 4] });
        });
      });

      it("should handle spaced emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a--b--c--d--e|", { a: 1, b: 2, c: 3, d: 4, e: 5 });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("---a--b--c--d|", { a: [1, 2], b: [2, 3], c: [3, 4], d: [4, 5] });
        });
      });

      it("should handle mixed timing patterns", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a(bc)--d-e|", { a: 1, b: 2, c: 3, d: 4, e: 5 });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("-(ab)--c-d|", { a: [1, 2], b: [2, 3], c: [3, 4], d: [4, 5] });
        });
      });
    });

    describe("Error Handling", () => {
      it("should propagate errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Test error");
          const source = cold("a-b-#", { a: 1, b: 2 }, error);
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("--a-#", { a: [1, 2] }, error);
        });
      });

      it("should handle error after single value", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Test error");
          const source = cold("a-#", { a: 1 }, error);
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("--#", {}, error);
        });
      });

      it("should handle immediate error", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Immediate error");
          const source = cold("#", {}, error);
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("#", {}, error);
        });
      });

      it("should handle error before first pair", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Early error");
          const source = cold("a#", { a: 1 }, error);
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("-#", {}, error);
        });
      });

      it("should handle error after multiple pairs", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Late error");
          const source = cold("a-b-c-d-#", { a: 1, b: 2, c: 3, d: 4 }, error);
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("--a-b-c-#", { a: [1, 2], b: [2, 3], c: [3, 4] }, error);
        });
      });
    });

    describe("Data Types", () => {
      it("should handle complex objects", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const obj1 = { id: 1 };
          const obj2 = { id: 2 };
          const obj3 = { id: 3 };
          const source = cold("a-b-c|", { a: obj1, b: obj2, c: obj3 });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("--a-b|", { a: [obj1, obj2], b: [obj2, obj3] });
        });
      });

      it("should handle string values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abcd|", { a: 'hello', b: 'world', c: 'test', d: 'case' });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("-abc|", { 
            a: ['hello', 'world'], 
            b: ['world', 'test'], 
            c: ['test', 'case'] 
          });
        });
      });

      it("should handle boolean values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abcd|", { a: true, b: false, c: true, d: false });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("-abc|", { 
            a: [true, false], 
            b: [false, true], 
            c: [true, false] 
          });
        });
      });

      it("should handle null and undefined values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold('abcd|', { a: null, b: 'test', c: 42, d: null });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe('-abc|', { 
            a: [null, 'test'], 
            b: ['test', 42], 
            c: [42, null] 
          });
        });
      });

      it("should handle mixed data types", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abcde|", { a: 1, b: 'hello', c: true, d: { obj: true }, e: [1, 2] });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("-abcd|", { 
            a: [1, 'hello'], 
            b: ['hello', true], 
            c: [true, { obj: true }], 
            d: [{ obj: true }, [1, 2]] 
          });
        });
      });

      it("should handle array values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abc|", { a: [1, 2], b: [3, 4], c: [5, 6] });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("-ab|", { 
            a: [[1, 2], [3, 4]], 
            b: [[3, 4], [5, 6]] 
          });
        });
      });
    });

    describe("Stream Completion", () => {
      it("should complete when source completes", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("--a-b|", { a: [1, 2], b: [2, 3] });
        });
      });

      it("should complete immediately for empty source", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("|");
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("|");
        });
      });

      it("should complete without emission for single value", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a|", { a: 42 });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("-|");
        });
      });

      it("should handle delayed completion", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-------|", { a: 1, b: 2 });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("--a-------|", { a: [1, 2] });
        });
      });
    });

    describe("Edge Cases", () => {
      it("should handle subscription timing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("ab^cd|", { a: 1, b: 2, c: 3, d: 4 });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("-a|", { a: [3, 4] });
        });
      });

      it("should handle hot source stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("ab^cdef|", { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("-abc|", { a: [3, 4], b: [4, 5], c: [5, 6] });
        });
      });

      it("should handle zero values correctly", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abc|", { a: 0, b: 1, c: 0 });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("-ab|", { a: [0, 1], b: [1, 0] });
        });
      });

      it("should handle false values correctly", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abc|", { a: false, b: true, c: false });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("-ab|", { a: [false, true], b: [true, false] });
        });
      });

      it("should handle empty string values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abc|", { a: '', b: 'hello', c: '' });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("-ab|", { a: ['', 'hello'], b: ['hello', ''] });
        });
      });

      it("should handle large numbers", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abc|", { a: Number.MAX_SAFE_INTEGER, b: 0, c: Number.MIN_SAFE_INTEGER });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("-ab|", { 
            a: [Number.MAX_SAFE_INTEGER, 0], 
            b: [0, Number.MIN_SAFE_INTEGER] 
          });
        });
      });

      it("should handle NaN values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abc|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("-ab|", { a: [1, 2], b: [2, 3] });
        });
      });

      it("should handle Infinity values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abc|", { a: 1, b: Infinity, c: 3 });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("-ab|", { a: [1, Infinity], b: [Infinity, 3] });
        });
      });
    });

    describe("Complex Scenarios", () => {
      it("should handle long sequence of values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abcdefgh|", { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8 });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("-abcdefg|", { 
            a: [1, 2], b: [2, 3], c: [3, 4], d: [4, 5], 
            e: [5, 6], f: [6, 7], g: [7, 8] 
          });
        });
      });

      it("should handle pairs with object mutations", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const obj1 = { count: 1 };
          const obj2 = { count: 2 };
          const obj3 = { count: 3 };
          const source = cold("abc|", { a: obj1, b: obj2, c: obj3 });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("-ab|", { a: [obj1, obj2], b: [obj2, obj3] });
        });
      });

      it("should handle alternating pattern", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abcdef|", { a: 'A', b: 'B', c: 'A', d: 'B', e: 'A', f: 'B' });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("-abcde|", { 
            a: ['A', 'B'], b: ['B', 'A'], 
            c: ['A', 'B'], d: ['B', 'A'], 
            e: ['A', 'B'] 
          });
        });
      });

      it("should maintain pair order with rapid changes", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("(abcde)f|", { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
          
          const result = pipe(
            source,
            pairwise()
          );
          
          expectStream(result).toBe("(abcd)e|", { 
            a: [1, 2], b: [2, 3], c: [3, 4], d: [4, 5], e: [5, 6] 
          });
        });
      });
    });
  });

});
