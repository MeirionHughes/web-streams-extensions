import { expect } from "chai";
import { toArray, from, map, pipe, filter } from '../../src/index.js';
import { parseMarbles } from "../../src/testing/parse-marbles.js";
import { VirtualTimeScheduler } from "../../src/testing/virtual-tick-scheduler.js";


describe("filter", () => {
  describe("Real Time", () => {
    it("can filter T", async () => {
      let inputA = [1, 2, 3, 4];
      let expected = inputA.filter(x=>x>1 && x<4)

      let result = await toArray(
        pipe(
          from(inputA),
          filter(x =>x>1 && x<4))
      );

      expect(result, "stream result matches expected").to.be.deep.eq(expected);
    })    
    
    it("can filter with function predicate", async () => {
      let inputA = [
        {type: "foo", value: 1},
        {type: "bar", value: 2},
        {type: "foo", value: 3}];

      interface IFoo { type: "foo", value: number };

      let predicate = function(obj: any): obj is IFoo{
        return obj["type"] == "foo";
      }

      let expected = inputA.filter(predicate)

      let result = await toArray(
        pipe(
          from(inputA),
          filter(predicate))
      );

      expect(result, "stream result matches expected").to.be.deep.eq(expected);
    })

    it("should handle empty streams", async () => {
      const result = await toArray(
        pipe(
          from([]),
          filter((x: number) => x > 0)
        )
      );
      expect(result).to.deep.equal([]);
    });

    it("should filter out all elements", async () => {
      const result = await toArray(
        pipe(
          from([1, 2, 3]),
          filter((x: number) => x > 10)
        )
      );
      expect(result).to.deep.equal([]);
    });

    it("should pass all elements", async () => {
      const result = await toArray(
        pipe(
          from([1, 2, 3]),
          filter((x: number) => x > 0)
        )
      );
      expect(result).to.deep.equal([1, 2, 3]);
    });

    it("should pass parameters correctly", async () => {
      const values: string[] = [];
      await toArray(
        pipe(
          from(['a', 'b', 'c']),
          filter((x: string) => {
            values.push(x);
            return x !== 'b';
          })
        )
      );
      expect(values).to.deep.equal(['a', 'b', 'c']);
    });

    it("should handle type guards properly", async () => {
      const mixed: (string | number)[] = ['hello', 42, 'world', 3.14];
      const numbers = await toArray(
        pipe(
          from(mixed),
          filter((x: string | number): x is number => typeof x === 'number')
        )
      );
      expect(numbers).to.deep.equal([42, 3.14]);
    });
  });

  describe("Virtual Time", () => {
    describe("Basic Behavior", () => {
      it("should filter elements based on predicate", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcde|', { a: 1, b: 2, c: 3, d: 4, e: 5 });
          const result = pipe(stream, filter((x: number) => x % 2 === 1));
          expectStream(result).toBe('a-c-e|', { a: 1, c: 3, e: 5 });
        });
      });

      it("should handle empty source stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('|');
          const result = pipe(stream, filter((x: number) => x > 0));
          expectStream(result).toBe('|');
        });
      });

      it("should filter out all elements", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, filter((x: number) => x > 10));
          expectStream(result).toBe('---|');
        });
      });

      it("should pass all elements", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, filter((x: number) => x > 0));
          expectStream(result).toBe('abc|', { a: 1, b: 2, c: 3 });
        });
      });

      it("should handle single element streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a|', { a: 5 });
          const result = pipe(stream, filter((x: number) => x > 3));
          expectStream(result).toBe('a|', { a: 5 });
        });
      });

      it("should filter single element that doesn't match", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a|', { a: 1 });
          const result = pipe(stream, filter((x: number) => x > 3));
          expectStream(result).toBe('-|');
        });
      });
    });

    describe("Timing Patterns", () => {
      it("should preserve timing of filtered elements", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a--b--c--d--e|', { a: 1, b: 2, c: 3, d: 4, e: 5 });
          const result = pipe(stream, filter((x: number) => x % 2 === 0));
          expectStream(result).toBe('---b-----d---|', { b: 2, d: 4 });
        });
      });

      it("should handle rapid emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('(abcde)|', { a: 1, b: 2, c: 3, d: 4, e: 5 });
          const result = pipe(stream, filter((x: number) => x < 4));
          expectStream(result).toBe('(abc)|', { a: 1, b: 2, c: 3 });
        });
      });

      it("should handle spaced emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-----b-----c|', { a: 10, b: 5, c: 15 });
          const result = pipe(stream, filter((x: number) => x >= 10));
          expectStream(result).toBe('a-----------c|', { a: 10, c: 15 });
        });
      });

      it("should handle delayed emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('------a--b--c|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, filter((x: number) => x > 1));
          expectStream(result).toBe('---------b--c|', { b: 2, c: 3 });
        });
      });

      it("should handle mixed timing patterns", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a(bc)--d-e-f|', { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
          const result = pipe(stream, filter((x: number) => x % 2 === 1));
          expectStream(result).toBe('a(c)----e--|', { a: 1, c: 3, e: 5 });
        });
      });

      it("should handle very long streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a---------b---------c---------d|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, filter((x: number) => x % 2 === 0));
          expectStream(result).toBe('----------b-------------------d|', { b: 2, d: 4 });
        });
      });
    });

    describe("Error Handling", () => {
      it("should propagate source stream errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab#', { a: 1, b: 2 });
          const result = pipe(stream, filter((x: number) => x > 0));
          expectStream(result).toBe('ab#', { a: 1, b: 2 });
        });
      });

      it("should handle predicate function errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab|', { a: 1, b: 2 });
          const result = pipe(stream, filter((x: number) => {
            if (x === 2) throw new Error('predicate error');
            return x > 0;
          }));
          expectStream(result).toBe('a#', { a: 1 }, new Error('predicate error'));
        });
      });

      it("should handle error before any emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('#');
          const result = pipe(stream, filter((x: number) => x > 0));
          expectStream(result).toBe('#');
        });
      });

      it("should handle error after filtered element", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab#', { a: 1, b: 10 });
          const result = pipe(stream, filter((x: number) => x < 5));
          expectStream(result).toBe('a-#', { a: 1 });
        });
      });

      it("should handle error in complex predicate", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: { val: 1 }, b: null, c: { val: 3 } });
          const result = pipe(stream, filter((x: any) => x.val > 0)); // Will error on null
          expectStream(result).toBe('a#', { a: { val: 1 } }, new Error('Expected runtime error')).throws(err => {
            expect(err.cause).to.be.instanceOf(TypeError);
            const cause = err.cause as TypeError;
            expect(cause.message).to.satisfy((msg: string) => {
              // Browser-agnostic check for property access error on null
              return (
                msg.includes('null') || 
                msg.includes('properties') || 
                msg.includes('object')
              );
            });
          });
        });
      });
    });

    describe("Stream Completion", () => {
      it("should complete when source completes", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, filter((x: number) => x > 1));
          expectStream(result).toBe('-bc|', { b: 2, c: 3 });
        });
      });

      it("should complete immediately for empty source", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('|');
          const result = pipe(stream, filter((x: number) => x > 0));
          expectStream(result).toBe('|');
        });
      });

      it("should complete with no emissions if all filtered", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, filter((x: number) => x > 10));
          expectStream(result).toBe('---|');
        });
      });

      it("should handle delayed completion", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-------|', { a: 1 });
          const result = pipe(stream, filter((x: number) => x > 0));
          expectStream(result).toBe('a-------|', { a: 1 });
        });
      });
    });

    describe("Data Types", () => {
      it("should handle string filtering", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { a: 'hello', b: 'world', c: 'foo', d: 'bar' });
          const result = pipe(stream, filter((x: string) => x.length > 3));
          expectStream(result).toBe('ab--|', { a: 'hello', b: 'world' });
        });
      });

      it("should handle object filtering", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { 
            a: { id: 1, active: true }, 
            b: { id: 2, active: false }, 
            c: { id: 3, active: true } 
          });
          const result = pipe(stream, filter((x: any) => x.active));
          expectStream(result).toBe('a-c|', { 
            a: { id: 1, active: true }, 
            c: { id: 3, active: true } 
          });
        });
      });

      it("should handle array filtering", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: [1], b: [1, 2], c: [1, 2, 3] });
          const result = pipe(stream, filter((x: number[]) => x.length > 1));
          expectStream(result).toBe('-bc|', { b: [1, 2], c: [1, 2, 3] });
        });
      });

      it("should handle boolean filtering", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { a: true, b: false, c: true, d: false });
          const result = pipe(stream, filter((x: boolean) => x));
          expectStream(result).toBe('a-c-|', { a: true, c: true });
        });
      });

      it("should handle null and undefined values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { a: 1, b: null, c: 'null_placeholder', d: 2 });
          const result = pipe(stream, filter((x: any) => {
            if (x === 'null_placeholder') x = undefined;
            return x != null;
          }));
          expectStream(result).toBe('a--d|', { a: 1, d: 2 });
        });
      });

      it("should handle mixed data types", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcde|', { a: 1, b: 'hello', c: true, d: null, e: { obj: true } });
          const result = pipe(stream, filter((x: any) => typeof x === 'object' && x !== null));
          expectStream(result).toBe('----e|', { e: { obj: true } });
        });
      });
    });

    describe("Edge Cases", () => {
      it("should handle subscription timing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab^cd|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, filter((x: number) => x > 2));
          expectStream(result).toBe('cd|', { c: 3, d: 4 });
        });
      });

      it("should handle hot source stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab^cdef|', { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
          const result = pipe(stream, filter((x: number) => x % 2 === 0));
          expectStream(result).toBe('-d-f|', { d: 4, f: 6 });
        });
      });

      it("should handle zero values correctly", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 0, b: 1, c: 2 });
          const result = pipe(stream, filter((x: number) => x >= 0));
          expectStream(result).toBe('abc|', { a: 0, b: 1, c: 2 });
        });
      });

      it("should handle false values correctly", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: false, b: true, c: false });
          const result = pipe(stream, filter((x: boolean) => x === false));
          expectStream(result).toBe('a-c|', { a: false, c: false });
        });
      });

      it("should handle empty string values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: '', b: 'hello', c: '' });
          const result = pipe(stream, filter((x: string) => x.length === 0));
          expectStream(result).toBe('a-c|', { a: '', c: '' });
        });
      });

      it("should handle large numbers", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: Number.MAX_SAFE_INTEGER, b: 100, c: Number.MIN_SAFE_INTEGER });
          const result = pipe(stream, filter((x: number) => Math.abs(x) > 1000));
          expectStream(result).toBe('a-c|', { a: Number.MAX_SAFE_INTEGER, c: Number.MIN_SAFE_INTEGER });
        });
      });
    });

    describe("Complex Scenarios", () => {
      it("should handle value-based filtering", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcdef|', { a: 10, b: 20, c: 30, d: 40, e: 50, f: 60 });
          const result = pipe(stream, filter((x: number) => x >= 30));
          expectStream(result).toBe('--cdef|', { c: 30, d: 40, e: 50, f: 60 });
        });
      });

      it("should handle complex predicate logic", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcdef|', { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
          const result = pipe(stream, filter((x: number) => x > 2 && x < 5 && x % 2 === 1));
          expectStream(result).toBe('--c---|', { c: 3 });
        });
      });

      it("should handle type guard predicates", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { a: 'string', b: 42, c: true, d: 'another' });
          const result = pipe(stream, filter((x: any): x is string => typeof x === 'string'));
          expectStream(result).toBe('a--d|', { a: 'string', d: 'another' });
        });
      });

      it("should handle chained filtering", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcdef|', { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
          const result = pipe(
            stream, 
            filter((x: number) => x > 2),
            filter((x: number) => x < 6),
            filter((x: number) => x % 2 === 0)
          );
          expectStream(result).toBe('---d--|', { d: 4 });
        });
      });

      it("should handle filtering with state", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          let count = 0;
          const stream = cold('aaaaaaa|', { a: 1 });
          const result = pipe(stream, filter((x: number) => {
            count++;
            return count % 3 === 0;
          }));
          expectStream(result).toBe('--a--a-|', { a: 1 });
        });
      });

      it("should handle alternating filter pattern", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abababab|', { a: 1, b: 2 });
          const result = pipe(stream, filter((x: number) => x === 1));
          expectStream(result).toBe('a-a-a-a-|', { a: 1 });
        });
      });
    });
  });
});

