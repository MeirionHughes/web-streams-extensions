import { expect } from "chai";
import { from, pipe, reduce, toArray } from "../../src/index.js";
import { parseMarbles } from '../../src/testing/parse-marbles.js';
import { VirtualTimeScheduler } from '../../src/testing/virtual-tick-scheduler.js';


describe("reduce", () => {

  describe("Real Time", () => {
    it("should emit only final accumulated value", async () => {
      const input = [1, 2, 3, 4];
      const expected = [10]; // Only final result, not intermediate values
      
      const result = await toArray(pipe(
        from(input),
        reduce((acc, val) => acc + val, 0)
      ));
      
      expect(result).to.deep.equal(expected);
    });

    it("should work with different types", async () => {
      const input = [1, 2, 3];
      const expected = ["123"];
      
      const result = await toArray(pipe(
        from(input),
        reduce((acc, val) => acc + val.toString(), "")
      ));
      
      expect(result).to.deep.equal(expected);
    });

    it("should pass index to accumulator", async () => {
      const input = [10, 20, 30];
      const expected = [163]; // 100 + (10+0) + (20+1) + (30+2)
      
      const result = await toArray(pipe(
        from(input),
        reduce((acc, val, index) => acc + val + index, 100)
      ));
      
      expect(result).to.deep.equal(expected);
    });

    it("should handle async accumulator", async () => {
      const input = [1, 2, 3];
      const expected = [6];
      
      const result = await toArray(pipe(
        from(input),
        reduce(async (acc, val) => {
          await new Promise(resolve => setTimeout(resolve, 1));
          return acc + val;
        }, 0)
      ));
      
      expect(result).to.deep.equal(expected);
    });

    it("should handle empty stream", async () => {
      const result = await toArray(pipe(
        from([]),
        reduce((acc, val) => acc + val, 42)
      ));
      
      expect(result).to.deep.equal([42]); // Should emit seed for empty stream
    });

  }); // Real Time

  describe("Virtual Time", () => {
    describe("Basic Behavior", () => {
      it("should emit final accumulated value only on completion", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            reduce((acc: number, val: number) => acc + val, 0)
          );
          
          expectStream(result).toBe("-----(a|)", { a: 6 });
        });
      });

      it("should emit seed value for empty streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("|", {} as Record<string, number>, undefined);
          
          const result = pipe(
            source,
            reduce((acc: number, val: number) => acc + val, 42)
          );
          
          expectStream(result).toBe("(a|)", { a: 42 });
        });
      });

      it("should handle single value streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a|", { a: 5 });
          
          const result = pipe(
            source,
            reduce((acc: number, val: number) => acc + val, 10)
          );
          
          expectStream(result).toBe("-(a|)", { a: 15 });
        });
      });

      it("should handle two value streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b|", { a: 3, b: 7 });
          
          const result = pipe(
            source,
            reduce((acc: number, val: number) => acc + val, 0)
          );
          
          expectStream(result).toBe("---(a|)", { a: 10 });
        });
      });

      it("should handle multiplication accumulation", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abc|", { a: 2, b: 3, c: 4 });
          
          const result = pipe(
            source,
            reduce((acc: number, val: number) => acc * val, 1)
          );
          
          expectStream(result).toBe("---(a|)", { a: 24 });
        });
      });
    });

    describe("Timing Patterns", () => {
      it("should work with different timing patterns", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a---b-c--d|", { a: 1, b: 2, c: 3, d: 4 });
          
          const result = pipe(
            source,
            reduce((acc: number, val: number) => acc * val, 1)
          );
          
          expectStream(result).toBe("----------(a|)", { a: 24 });
        });
      });

      it("should handle immediate emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("(abc)|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            reduce((acc: number, val: number) => acc + val, 0)
          );
          
          expectStream(result).toBe("-(a|)", { a: 6 });
        });
      });

      it("should handle long streams with delays", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a------b------c------|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            reduce((acc: number, val: number) => acc + val, 0)
          );
          
          expectStream(result).toBe("---------------------(a|)", { a: 6 });
        });
      });

      it("should handle spaced emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a--b--c--d|", { a: 1, b: 2, c: 3, d: 4 });
          
          const result = pipe(
            source,
            reduce((acc: number, val: number) => acc + val, 0)
          );
          
          expectStream(result).toBe("----------(a|)", { a: 10 });
        });
      });

      it("should handle burst then delay pattern", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("(abc)d|", { a: 1, b: 2, c: 3, d: 4 });
          
          const result = pipe(
            source,
            reduce((acc: number, val: number) => acc + val, 0)
          );
          
          expectStream(result).toBe("--(a|)", { a: 10 });
        });
      });

      it("should handle delayed start", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("-----abc|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            reduce((acc: number, val: number) => acc + val, 0)
          );
          
          expectStream(result).toBe("--------(a|)", { a: 6 });
        });
      });
    });

    describe("Error Handling", () => {
      it("should propagate errors from source", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Source error");
          const source = cold("a-b-#", { a: 1, b: 2 }, error);
          
          const result = pipe(
            source,
            reduce((acc: number, val: number) => acc + val, 0)
          );
          
          expectStream(result).toBe("----#", {}, error);
        });
      });

      it("should propagate errors from accumulator function", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Accumulator error");
          const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            reduce((acc: number, val: number) => {
              if (val === 2) throw error;
              return acc + val;
            }, 0)
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
            reduce((acc: number, val: number) => acc + val, 10)
          );
          
          expectStream(result).toBe("#", {}, error);
        });
      });

      it("should handle error on first value", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("First value error");
          const source = cold("a|", { a: 1 });
          
          const result = pipe(
            source,
            reduce((acc: number, val: number) => {
              throw error;
            }, 0)
          );
          
          expectStream(result).toBe("#", {}, error);
        });
      });

      it("should handle error after some accumulation", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Late error");
          const source = cold("a-b-c-d|", { a: 1, b: 2, c: 3, d: 4 });
          
          const result = pipe(
            source,
            reduce((acc: number, val: number) => {
              if (val === 3) throw error;
              return acc + val;
            }, 0)
          );
          
          expectStream(result).toBe("----#", {}, error);
        });
      });
    });

    describe("Data Types", () => {
      it("should handle type transformations", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            reduce((acc: string, val: number) => acc + val.toString(), "")
          );
          
          expectStream(result).toBe("-----(a|)", { a: "123" });
        });
      });

      it("should handle string concatenation", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abc|", { a: 'hello', b: ' ', c: 'world' });
          
          const result = pipe(
            source,
            reduce((acc: string, val: string) => acc + val, "")
          );
          
          expectStream(result).toBe("---(a|)", { a: "hello world" });
        });
      });

      it("should handle boolean operations", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abcd|", { a: true, b: false, c: true, d: false });
          
          const result = pipe(
            source,
            reduce((acc: boolean, val: boolean) => acc && val, true)
          );
          
          expectStream(result).toBe("----(a|)", { a: false });
        });
      });

      it("should handle array accumulation", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abc|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            reduce((acc: number[], val: number) => [...acc, val], [] as number[])
          );
          
          expectStream(result).toBe("---(a|)", { a: [1, 2, 3] });
        });
      });

      it("should handle complex object accumulation", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 'x', b: 'y', c: 'z' });
          
          const result = pipe(
            source,
            reduce((acc: { items: string[] }, val: string) => {
              return { items: [...acc.items, val] };
            }, { items: [] })
          );
          
          expectStream(result).toBe("-----(a|)", { a: { items: ['x', 'y', 'z'] } });
        });
      });

      it("should handle mixed data types", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abcd|", { a: 1, b: 'hello', c: true, d: null });
          
          const result = pipe(
            source,
            reduce((acc: any[], val: any) => [...acc, typeof val], [] as any[])
          );
          
          expectStream(result).toBe("----(a|)", { a: ['number', 'string', 'boolean', 'object'] });
        });
      });
    });

    describe("Advanced Operations", () => {
      it("should handle index parameter in accumulator", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 10, b: 20, c: 30 });
          
          const result = pipe(
            source,
            reduce((acc: number, val: number, index: number) => acc + val + index, 100)
          );
          
          expectStream(result).toBe("-----(a|)", { a: 163 }); // 100 + (10+0) + (20+1) + (30+2)
        });
      });

      it("should handle weighted sum with index", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abc|", { a: 5, b: 10, c: 15 });
          
          const result = pipe(
            source,
            reduce((acc: number, val: number, index: number) => acc + val * (index + 1), 0)
          );
          
          expectStream(result).toBe("---(a|)", { a: 70 }); // 5*1 + 10*2 + 15*3
        });
      });

      it("should handle conditional accumulation", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abcdef|", { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
          
          const result = pipe(
            source,
            reduce((acc: number, val: number) => val % 2 === 0 ? acc + val : acc, 0)
          );
          
          expectStream(result).toBe("------(a|)", { a: 12 }); // 2 + 4 + 6
        });
      });

      it("should handle max value accumulation", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abcde|", { a: 3, b: 1, c: 4, d: 1, e: 5 });
          
          const result = pipe(
            source,
            reduce((acc: number, val: number) => Math.max(acc, val), -Infinity)
          );
          
          expectStream(result).toBe("-----(a|)", { a: 5 });
        });
      });

      it("should handle min value accumulation", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abcde|", { a: 3, b: 1, c: 4, d: 1, e: 5 });
          
          const result = pipe(
            source,
            reduce((acc: number, val: number) => Math.min(acc, val), Infinity)
          );
          
          expectStream(result).toBe("-----(a|)", { a: 1 });
        });
      });
    });

    describe("Stream Completion", () => {
      it("should complete when source completes", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abc|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            reduce((acc: number, val: number) => acc + val, 0)
          );
          
          expectStream(result).toBe("---(a|)", { a: 6 });
        });
      });

      it("should complete immediately for empty source", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("|");
          
          const result = pipe(
            source,
            reduce((acc: number, val: number) => acc + val, 100)
          );
          
          expectStream(result).toBe("(a|)", { a: 100 });
        });
      });

      it("should handle delayed completion", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b--------|", { a: 1, b: 2 });
          
          const result = pipe(
            source,
            reduce((acc: number, val: number) => acc + val, 0)
          );
          
          expectStream(result).toBe("-----------(a|)", { a: 3 });
        });
      });

      it("should handle immediate completion after values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("(abc)|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            reduce((acc: number, val: number) => acc + val, 0)
          );
          
          expectStream(result).toBe("-(a|)", { a: 6 });
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
            reduce((acc: number, val: number) => acc + val, 0)
          );
          
          expectStream(result).toBe("--(a|)", { a: 7 });
        });
      });

      it("should handle hot source stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("ab^cdef|", { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
          
          const result = pipe(
            source,
            reduce((acc: number, val: number) => acc + val, 0)
          );
          
          expectStream(result).toBe("----(a|)", { a: 18 });
        });
      });

      it("should handle zero values correctly", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abc|", { a: 0, b: 1, c: 0 });
          
          const result = pipe(
            source,
            reduce((acc: number, val: number) => acc + val, 5)
          );
          
          expectStream(result).toBe("---(a|)", { a: 6 });
        });
      });

      it("should handle false values correctly", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abc|", { a: false, b: true, c: false });
          
          const result = pipe(
            source,
            reduce((acc: boolean, val: boolean) => acc || val, false)
          );
          
          expectStream(result).toBe("---(a|)", { a: true });
        });
      });

      it("should handle empty string values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abc|", { a: '', b: 'hello', c: '' });
          
          const result = pipe(
            source,
            reduce((acc: string, val: string) => acc + val + '-', 'start-')
          );
          
          expectStream(result).toBe("---(a|)", { a: 'start--hello--' });
        });
      });

      it("should handle large numbers", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abc|", { a: 1, b: Number.MAX_SAFE_INTEGER, c: 1 });
          
          const result = pipe(
            source,
            reduce((acc: number, val: number) => acc + val, 0)
          );
          
          expectStream(result).toBe("---(a|)", { a: Number.MAX_SAFE_INTEGER + 2 });
        });
      });

      it("should handle NaN values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abc|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            reduce((acc: number, val: number) => isNaN(acc) ? val : acc + val, NaN)
          );
          
          expectStream(result).toBe("---(a|)", { a: 6 }); // NaN + 1 = NaN, then reset to 1, then 1+2+3 = 6
        });
      });

      it("should handle Infinity values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abc|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            reduce((acc: number, val: number) => isFinite(acc) ? acc + val : val, Infinity)
          );
          
          expectStream(result).toBe("---(a|)", { a: 6 }); // Infinity is not finite, so reset to 1, then 1+2+3 = 6
        });
      });
    });
  });

});
