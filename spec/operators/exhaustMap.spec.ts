import { expect } from "chai";
import { from, pipe, toArray, exhaustMap, timer, Subject, interval, skip, exhaustAll, mapSync, take, map } from "../../src/index.js";
import { sleep } from "../../src/utils/sleep.js";
import { parseMarbles } from "../../src/testing/parse-marbles.js";
import { VirtualTimeScheduler } from "../../src/testing/virtual-tick-scheduler.js";


describe("exhaustMap", () => {
  describe("Real Time", () => {
    it("should ignore new inner streams while current is active", async () => {
        const resultPromise = toArray(
          pipe(
            from(async function *(){            
                yield pipe(interval(10),skip(1), take(3), mapSync(x=>x)), 
                await sleep(30); 
                yield pipe(interval(10),skip(1), take(3), mapSync(x=>x*10)), 
                await sleep(30); 
                yield pipe(interval(10),skip(1), take(3), mapSync(x=>x*100))
            }),
            exhaustMap(x=>pipe(x, mapSync(x=>x.toString())))
          )
        );
        const result = await resultPromise;
        expect(result).to.deep.equal(["1", "2", "3", "100", "200", "300"]);
      });

    it("should work with arrays", async () => {
      const result = await toArray(pipe(
        from([1, 2, 3]),
        exhaustMap(n => [n])
      ));
      expect(result[0]).to.equal(1);
    });

    it("should work with promises", async () => {
      const result = await toArray(pipe(
        from([1, 2]),
        exhaustMap(n => Promise.resolve(n * 2))
      ));
      // With exhaust semantics, only first value should be processed
      expect(result).to.deep.equal([2]);
    });

    it("should handle empty source stream", async () => {
      const result = await toArray(pipe(
        from([]),
        exhaustMap(n => [n])
      ));
      expect(result).to.deep.equal([]);
    });

    it("should handle stream errors", async () => {
      const source = new Subject<number>();
      const errorMessage = "test error";
      
      const streamPromise = toArray(pipe(
        source.readable,
        exhaustMap(n => [n])
      ));

      source.error(new Error(errorMessage));

      try {
        await streamPromise;
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err.message).to.equal(errorMessage);
      }
    });

    it("should handle errors in projection function", async () => {
      const errorMessage = "projection error";
      
      try {
        await toArray(pipe(
          from([1]),
          exhaustMap(() => {
            throw new Error(errorMessage);
          })
        ));
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err.message).to.equal(errorMessage);
      }
    });

    it("should handle cancellation properly", async () => {
      const source = new Subject<number>();
      let cancelled = false;
      
      const stream = pipe(
        source.readable,
        exhaustMap(n => from([n]))
      );
      
      const reader = stream.getReader();
      
      // Start reading
      const readPromise = reader.read();
      
      // Cancel immediately
      reader.cancel("test cancel").then(() => {
        cancelled = true;
      });
      
      source.next(1);
      
      const result = await readPromise;
      expect(result.done).to.be.true;
      
      // Allow some time for cleanup
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(cancelled).to.be.true;
    });

    it("should handle cancellation while processing inner stream", async () => {
      const source = new Subject<number>();
      let cancelled = false;
      
      const stream = pipe(
        source.readable,
        exhaustMap(n => from([n, n * 10, n * 100])) // Longer inner stream
      );
      
      const reader = stream.getReader();
      
      // Start reading to initiate inner stream processing
      source.next(1);
      
      // Read first value
      const firstResult = await reader.read();
      expect(firstResult.value).to.equal(1);
      
      // Cancel while inner stream is still active
      reader.cancel("test cancel").then(() => {
        cancelled = true;
      });
      
      // Allow some time for cleanup
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(cancelled).to.be.true;
    });

    it("should work with custom highWaterMark", async () => {
      const source = from([1, 2, 3]);
      const result = await toArray(
        exhaustMap(n => [n])(source, { highWaterMark: 1 })
      );
      expect(result[0]).to.equal(1);
    });

    it("should handle inner stream completion before new source values", async () => {
      // Use a controlled subject to emit values at specific times
      const source = new Subject<number>();
      
      let innerStreamCount = 0;
      const streamPromise = toArray(pipe(
        source.readable,
        exhaustMap(n => {
          innerStreamCount++;
          return from([n, n * 10]);
        })
      ));

      // Emit first value
      source.next(1);
      
      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Emit second value after first inner stream completes
      source.next(2);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Complete the source
      source.complete();

      const result = await streamPromise;
      
      // Should have processed both values since they didn't overlap
      expect(innerStreamCount).to.equal(2);
      expect(result).to.include.members([1, 10, 2, 20]);
    });

    it("should work with rapidly emitted values", async () => {
      // Test with timed source where inner streams complete quickly
      // Source emits every 1ms, inner streams are instant
      const result = await toArray(pipe(
        interval(1),
        take(3), // Emit 0, 1, 2 at 1ms intervals
        exhaustMap(n => [n * 10]) // Each maps to instant array
      ));
      
      // With exhaust semantics and instant inner arrays, all values should be processed
      // because each inner array completes immediately, allowing the next outer value
      expect(result).to.deep.equal([0, 10, 20]);
    });

    it("should handle single value streams", async () => {
      const result = await toArray(pipe(
        from([42]),
        exhaustMap(n => [n * 2])
      ));
      expect(result).to.deep.equal([84]);
    });

    it("should pass index to projection function", async () => {
      let indices: number[] = [];
      
      await toArray(pipe(
        interval(1),
        take(3), // Emit 0, 1, 2 at 1ms intervals
        exhaustMap(async (n: number, index: number) => {
          indices.push(index);
          await sleep(50); 
          return [index];
        })
      ));
      
      // With exhaust semantics, only first value should be processed
      expect(indices).to.deep.equal([0]);
    });
  });

  describe("Virtual Time", () => {
    describe("Basic Behavior", () => {
      it("should map source values to inner streams and flatten first one", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a--b--c|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, exhaustMap((x: number) => cold('--x|', { x: x * 10 })));
          expectStream(result, { strict: false }).toBe('--a-----c|', { a: 10, c: 30 });
        });
      });

      it("should ignore overlapping inner streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-b-c|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, exhaustMap((x: number) => cold('---x|', { x: x * 10 })));
          expectStream(result, { strict: false }).toBe('---a|', { a: 10 });
        });
      });

      it("should handle empty source stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('|');
          const result = pipe(stream, exhaustMap((x: number) => cold('x|', { x })));
          expectStream(result).toBe('|');
        });
      });

      it("should handle single source value", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a|', { a: 1 });
          const result = pipe(stream, exhaustMap((x: number) => cold('--x--y|', { x: x * 10, y: x * 20 })));
          expectStream(result, { strict: false }).toBe('--a--b|', { a: 10, b: 20 });
        });
      });

      it("should process non-overlapping inner streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-----b|', { a: 1, b: 2 });
          const result = pipe(stream, exhaustMap((x: number) => cold('--x|', { x: x * 10 })));
          expectStream(result, { strict: false }).toBe('--a-----b|', { a: 10, b: 20 });
        });
      });

      it("should handle immediate inner stream completion", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-b-c|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, exhaustMap((x: number) => cold('(x|)', { x: x * 10 })));
          expectStream(result, { strict: false }).toBe('a-b-c|', { a: 10, b: 20, c: 30 });
        });
      });
    });

    describe("Timing Patterns", () => {
      it("should respect timing of inner stream emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a|', { a: 1 });
          const result = pipe(stream, exhaustMap((x: number) => cold('-a-b-c|', { a: x, b: x * 2, c: x * 3 })));
          expectStream(result, { strict: false }).toBe('-a-b-c|', { a: 1, b: 2, c: 3 });
        });
      });

      it("should handle delayed inner stream start", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a|', { a: 1 });
          const result = pipe(stream, exhaustMap((x: number) => cold('----x|', { x: x * 10 })));
          expectStream(result, { strict: false }).toBe('----a|', { a: 10 });
        });
      });

      it("should handle burst emissions from source", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('(abc)|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, exhaustMap((x: number) => cold('--x|', { x: x * 10 })));
          expectStream(result, { strict: false }).toBe('--a|', { a: 10 });
        });
      });

      it("should handle long-running inner streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-b-c-d|');
          const result = pipe(stream, exhaustMap((x: number) => cold('a-------b|')));
          expectStream(result, { strict: false }).toBe('a-------b|');
        });
      });

      it("should handle rapid inner stream succession", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a--b--c|');
          const result = pipe(stream, exhaustMap((x: number) => cold('x|')));
          expectStream(result, { strict: false }).toBe('x--x--x|');
        });
      });

      it("should handle mixed timing patterns", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a--b----c|');
          const result = pipe(stream, exhaustMap((x: number) => cold('-x-y|')));
          expectStream(result, { strict: false }).toBe('-x-y-----x-y|');
        });
      });
    });

    describe("Error Handling", () => {
      it("should propagate source stream errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-#');
          const result = pipe(stream, exhaustMap((x: number) => cold('--x|')));
          expectStream(result).toBe('--#');
        });
      });

      it("should propagate inner stream errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a|');
          const result = pipe(stream, exhaustMap((x: number) => cold('--#')));
          expectStream(result).toBe('--#');
        });
      });

      it("should handle projection function errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        const error = new Error('projection error');
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a|');
          const result = pipe(stream, exhaustMap((x: number) => {
            throw error
          }));
          expectStream(result).toBe('#', undefined, error);
        });
      });

      it("should handle error after inner stream completion", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a--b--#', { a: 1, b: 2 });
          const result = pipe(stream, exhaustMap((x: number) => cold('x|', { x: x * 10 })));
          expectStream(result).toBe('a--b--#', { a: 10, b: 20 });
        });
      });

      it("should handle error in ignored inner stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-b|', { a: 1, b: 2 });
          const result = pipe(stream, exhaustMap((x: number) => {
            if (x === 1) return cold('--a--|');
            if (x === 2) return cold('#'); // Should be ignored
            return cold('x|', { x });
          }));
          expectStream(result, ).toBe('--a--|');
        });
      });

      it("should handle error before any inner streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('#');
          const result = pipe(stream, exhaustMap((x: number) => cold('x|', { x: x * 10 })));
          expectStream(result).toBe('#');
        });
      });
    });

    describe("Stream Completion", () => {
      it("should complete when source completes and no active inner stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-|', { a: 1 });
          const result = pipe(stream, exhaustMap((x: number) => cold('x|', { x: x * 10 })));
          expectStream(result, { strict: false }).toBe('a-|', { a: 10 });
        });
      });

      it("should wait for active inner stream to complete", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a|');
          const result = pipe(stream, exhaustMap((x: number) => cold('--a--b|')));
          expectStream(result).toBe('--a--b|');
        });
      });

      it("should handle immediate source completion", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('|');
          const result = pipe(stream, exhaustMap((x: number) => cold('x|', { x: x * 10 })));
          expectStream(result).toBe('|');
        });
      });

      it("should handle source completion with pending inner streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-b|');
          const result = pipe(stream, exhaustMap((x: number) => cold('----x|')));
          expectStream(result).toBe('----x|');
        });
      });

      it("should complete immediately if all inner streams complete", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|');
          const result = pipe(stream, exhaustMap((x: number) => cold('|')));
          expectStream(result).toBe('---|');
        });
      });
    });

    describe("Data Types", () => {
      it("should handle different value types", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 'hello', b: 42, c: true });
          const result = pipe(stream, exhaustMap((x: any) => cold('(x|)', { x: typeof x })));
          expectStream(result, { strict: false }).toBe('abc|', { a: 'string', b: 'number', c: 'boolean' });
        });
      });

      it("should handle object transformations", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a|', { a: { id: 1, name: 'Alice' } });
          const result = pipe(stream, exhaustMap((x: any) => cold('xy|', { 
            x: x.id, 
            y: x.name 
          })));
          expectStream(result, { strict: false }).toBe('ab|', { a: 1, b: 'Alice' });
        });
      });

      it("should handle array transformations", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a|', { a: [1, 2, 3] });
          const result = pipe(stream, exhaustMap((x: number[]) => cold('abc|', { 
            a: x[0], 
            b: x[1], 
            c: x[2] 
          })));
          expectStream(result, { strict: false }).toBe('abc|', { a: 1, b: 2, c: 3 });
        });
      });

      it("should handle mixed output types from projection", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, exhaustMap((x: number) => {
            return cold('v|', { v: x * 100 }); // Keep consistent output type
          }));
          expectStream(result, { strict: false }).toBe('a-c|', { a: 100, c: 300 });
        });
      });

      it("should handle null and undefined values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: null, b: undefined, c: 0 });
          const result = pipe(stream, exhaustMap((x: any) => cold('x|', { x: x ?? 'default' })));
          expectStream(result, { strict: false }).toBe('a-c|', { a: 'default', c: 0 });
        });
      });
    });

    describe("Edge Cases", () => {
      it("should handle subscription timing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a^b|', { a: 1, b: 2 });
          const result = pipe(stream, exhaustMap((x: number) => cold('--x|', { x: x * 10 })));
          expectStream(result, { strict: false }).toBe('--b|', { b: 20 });
        });
      });

      it("should handle hot source stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab^cd|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, exhaustMap((x: number) => cold('--x|', { x: x * 10 })));
          expectStream(result, { strict: false }).toBe('--c|', { c: 30 });
        });
      });

      it("should handle empty inner streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-b|', { a: 1, b: 2 });
          const result = pipe(stream, exhaustMap((x: number) => cold('|')));
          expectStream(result, { strict: false }).toBe('---|');
        });
      });

      it("should handle very long inner streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-b-c|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, exhaustMap((x: number) => cold('a---------b|', { a: x, b: x * 10 })));
          expectStream(result, { strict: false }).toBe('a---------b|', { a: 1, b: 10 });
        });
      });

      it("should handle projection to promises", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-b|', { a: 1, b: 2 });
          const result = pipe(stream, exhaustMap((x: number) => Promise.resolve(x * 10)));
          expectStream(result, { strict: false }).toBe('a-b|', { a: 10, b: 20 });
        });
      });

      it("should handle projection to arrays", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-b|', { a: 1, b: 2 });
          const result = pipe(stream, exhaustMap((x: number) => [x, x * 10]));
          expectStream(result, { strict: false }).toBe('(ab)-(cd)|', { a: 1, b: 10, c: 2, d: 20 });
        });
      });

      it("should handle very rapid source emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('(abcdef)|', { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
          const result = pipe(stream, exhaustMap((x: number) => cold('-x|', { x: x * 10 })));
          expectStream(result, { strict: false }).toBe('-a|', { a: 10 });
        });
      });
    });

    describe("Complex Scenarios", () => {
      it("should handle mixed timing with gaps", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a--b----c--d|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, exhaustMap((x: number) => cold('--x|', { x: x * 10 })));
          expectStream(result, { strict: false }).toBe('--a-------b-|', { a: 10, b: 30 });
        });
      });

      it("should handle index parameter correctly", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-b-c|', { a: 10, b: 20, c: 30 });
          const result = pipe(stream, exhaustMap((x: number, index: number) => cold('-----i|', { i: index })));
          expectStream(result, { strict: false }).toBe('-----a|', { a: 0 });
        });
      });

      it("should handle projection returning different stream types", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a----b----c|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, exhaustMap((x: number) => {
            if (x === 1) return cold('(xy)|', { x: 'fast', y: 'stream' });
            if (x === 2) return cold('--s--l--o--w|', { s: 's', l: 'l', o: 'o', w: 'w' });
            return cold('z|', { z: 'single' });
          }));
          expectStream(result, { strict: false }).toBe('(ab)------c--d--e--f|', { 
            a: 'fast', 
            b: 'stream', 
            c: 's', 
            d: 'l', 
            e: 'o', 
            f: 'w'
          });
        });
      });

      it("should handle alternating pattern with exhaust behavior", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-a-a-a-a|', { a: 1 });
          const result = pipe(stream, exhaustMap((x: number) => cold('--x|', { x: x * 10 })));
          expectStream(result, { strict: false }).toBe('--a---b---c|', { a: 10, b: 10, c: 10 });
        });
      });

      it("should handle nested stream completions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-(b|)', { a: 1, b: 2 });
          const result = pipe(stream, exhaustMap((x: number) => cold('-(xy)|', { x: x, y: x * 10 })));
          expectStream(result, { strict: false }).toBe('-(ab)|', { a: 1, b: 10 });
        });
      });

      it("should handle exhaust behavior with overlapping timing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-b--c---d|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, exhaustMap((x: number) => cold('---x-y|', { x: x * 10, y: x * 100 })));
          expectStream(result, { strict: false }).toBe('---a-b------c-d|', { a: 10, b: 100, c: 40, d: 400 });
        });
      });
    });
  });
});
