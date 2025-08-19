import { expect } from "chai";
import { toArray, from, pipe, first } from '../../src/index.js';
import { Subject } from "../../src/subjects/subject.js";
import { parseMarbles } from "../../src/testing/parse-marbles.js";
import { VirtualTimeScheduler } from "../../src/testing/virtual-tick-scheduler.js";


describe("first", () => {
  describe("Real Time", () => {
    it("can get the first element of stream", async () => {
      let inputA = [1, 2, 3, 4];
      let expected = [1]

      let result = await toArray(
        pipe(
          from(inputA),
          first())
      );

      expect(result, "stream result matches expected").to.be.deep.eq(expected);
    })

    it("should get first element matching predicate", async () => {
      let input = [1, 3, 2, 4];
      let expected = [2];

      let result = await toArray(
        pipe(
          from(input),
          first((x: number) => x % 2 === 0)
        )
      );

      expect(result).to.deep.equal(expected);
    })

    it("should handle empty stream", async () => {
      let result = await toArray(
        pipe(
          from([]),
          first()
        )
      );

      expect(result).to.deep.equal([]);
    })

    it("should handle no elements matching predicate", async () => {
      let input = [1, 3, 5, 7];
      
      let result = await toArray(
        pipe(
          from(input),
          first((x: number) => x % 2 === 0)
        )
      );

      expect(result).to.deep.equal([]);
    })

    it("should work with complex predicate", async () => {
      let input = ["apple", "banana", "cherry", "date"];
      let expected = ["banana"];

      let result = await toArray(
        pipe(
          from(input),
          first((x: string) => x.length > 5)
        )
      );

      expect(result).to.deep.equal(expected);
    })

    it("should handle predicate errors", async () => {
      let input = [1, 2, 3];

      try {
        await toArray(
          pipe(
            from(input),
            first((x: number) => {
              if (x === 2) throw new Error("Predicate error");
              return x === 2; // Only match the element that will throw
            })
          )
        );
        expect.fail("Should have thrown an error");
      } catch (err: any) {
        expect(err.message).to.equal("Predicate error");
      }
    })

    it("should work with different types", async () => {
      let input = [{ id: 1 }, { id: 2 }, { id: 3 }];
      let expected = [{ id: 2 }];

      let result = await toArray(
        pipe(
          from(input),
          first((x: any) => x.id === 2)
        )
      );

      expect(result).to.deep.equal(expected);
    })

    it("should handle async streams", async () => {
      async function* asyncGenerator() {
        yield 1;
        yield 2;
        yield 3;
      }

      let result = await toArray(
        pipe(
          from(asyncGenerator()),
          first((x: number) => x > 1)
        )
      );

      expect(result).to.deep.equal([2]);
    })

    it("should handle stream errors", async () => {
      const errorStream = new ReadableStream({
        start(controller) {
          controller.enqueue(1);
          controller.error(new Error("Stream error"));
        }
      });

      try {
        await toArray(
          pipe(
            errorStream,
            first()
          )
        );
        expect.fail("Should have thrown an error");
      } catch (err: any) {
        expect(err.message).to.equal("Stream error");
      }
    })

    it("should handle cancellation", async () => {
      const subject = new Subject<number>();
      
      const stream = pipe(
        subject.readable,
        first((x: number) => x > 5)
      );
      
      const reader = stream.getReader();
      
      // Add some values that don't match
      await subject.next(1);
      await subject.next(2);
      
      // Cancel the reader
      await reader.cancel("Test cancellation");
      reader.releaseLock();
      
      // Complete the subject
      await subject.complete();
    })

    it("should handle cleanup errors during cancellation", async () => {
      const errorStream = new ReadableStream({
        start(controller) {
          controller.enqueue(1);
          controller.enqueue(2);
        },
        cancel() {
          throw new Error("Cancel error");
        }
      });

      const stream = pipe(
        errorStream,
        first()
      );
      
      const reader = stream.getReader();
      
      // Read first value to trigger completion and cleanup
      const result = await reader.read();
      expect(result.value).to.equal(1);
      expect(result.done).to.be.false;
      
      // Should complete after first
      const done = await reader.read();
      expect(done.done).to.be.true;
      
      await reader.cancel();
      reader.releaseLock();
    })

    it("should handle cleanup errors during error", async () => {
      const errorStream = new ReadableStream({
        start(controller) {
          controller.enqueue(1);
          setTimeout(() => controller.error(new Error("Stream error")), 10);
        },
        cancel() {
          throw new Error("Cancel error");
        }
      });

      try {
        await toArray(
          pipe(
            errorStream,
            first((x: number) => x > 1) // Won't match first value, will wait for error
          )
        );
        expect.fail("Should have thrown an error");
      } catch (err: any) {
        expect(err.message).to.equal("Stream error");
      }
    })

    it("should work with custom highWaterMark", async () => {
      let result = await toArray(
        first()(
          from([1, 2, 3]),
          { highWaterMark: 1 }
        )
      );

      expect(result).to.deep.equal([1]);
    })

    it("should handle boolean values", async () => {
      let input = [false, true, false];
      let expected = [true];

      let result = await toArray(
        pipe(
          from(input),
          first((x: boolean) => x === true)
        )
      );

      expect(result).to.deep.equal(expected);
    })

    it("should handle null and undefined values", async () => {
      let input = [null, undefined, 1, 2];
      let expected = [1];

      let result = await toArray(
        pipe(
          from(input),
          first((x: any) => x != null)
        )
      );

      expect(result).to.deep.equal(expected);
    })

    it("should work with single element stream", async () => {
      let result = await toArray(
        pipe(
          from([42]),
          first()
        )
      );

      expect(result).to.deep.equal([42]);
    })

    it("should handle very large stream efficiently", async () => {
      async function* largeGenerator() {
        for (let i = 1; i <= 1000000; i++) {
          yield i;
        }
      }

      let result = await toArray(
        pipe(
          from(largeGenerator()),
          first((x: number) => x === 1000)
        )
      );

      expect(result).to.deep.equal([1000]);
    })

    it("should handle early reader release scenario", async () => {
      const subject = new Subject<number>();
      
      const stream = pipe(
        subject.readable,
        first()
      );
      
      const reader = stream.getReader();
      
      // Add a value
      await subject.next(42);
      
      // Read should complete immediately
      const result = await reader.read();
      expect(result.value).to.equal(42);
      expect(result.done).to.be.false;
      
      // Next read should be done
      const done = await reader.read();
      expect(done.done).to.be.true;
      
      await reader.cancel();
      reader.releaseLock();
      await subject.complete();
    })

    it("should handle default selector", async () => {
      let input = [0, false, null, undefined, 1];
      let expected = [0]; // First element, regardless of truthiness

      let result = await toArray(
        pipe(
          from(input),
          first() // No selector, should return first element
        )
      );

      expect(result).to.deep.equal(expected);
    })
  });

  describe("Virtual Time", () => {
    describe("Basic Behavior", () => {
      it("should return first element without predicate", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcde|', { a: 1, b: 2, c: 3, d: 4, e: 5 });
          const result = pipe(stream, first());
          expectStream(result, { strict: false }).toBe('(a|)', { a: 1 });
        });
      });

      it("should return first element matching predicate", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcde|', { a: 1, b: 2, c: 3, d: 4, e: 5 });
          const result = pipe(stream, first((x: number) => x > 2));
          expectStream(result, { strict: false }).toBe('--(c|)', { c: 3 });
        });
      });

      it("should handle empty source stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('|');
          const result = pipe(stream, first());
          expectStream(result).toBe('|');
        });
      });

      it("should handle single element stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a|', { a: 42 });
          const result = pipe(stream, first());
          expectStream(result, { strict: false }).toBe('(a|)', { a: 42 });
        });
      });

      it("should handle no matching elements", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, first((x: number) => x > 10));
          expectStream(result).toBe('----|');
        });
      });

      it("should complete immediately after finding first match", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a--b--c--d|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, first((x: number) => x === 2));
          expectStream(result, { strict: false }).toBe('---(b|)', { b: 2 });
        });
      });
    });

    describe("Timing Patterns", () => {
      it("should preserve timing until first match", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('---a--b--c|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, first((x: number) => x === 2));
          expectStream(result, { strict: false }).toBe('------(b|)', { b: 2 });
        });
      });

      it("should handle rapid emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('(abcde)|', { a: 1, b: 2, c: 3, d: 4, e: 5 });
          const result = pipe(stream, first((x: number) => x > 3));
          expectStream(result, { strict: false }).toBe('(d|)', { d: 4 });
        });
      });

      it("should handle spaced emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-----b-----c|', { a: 10, b: 5, c: 15 });
          const result = pipe(stream, first((x: number) => x < 10));
          expectStream(result, { strict: false }).toBe('------(b|)', { b: 5 });
        });
      });

      it("should handle delayed start", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('------a--b--c|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, first());
          expectStream(result, { strict: false }).toBe('------(a|)', { a: 1 });
        });
      });

      it("should handle mixed timing patterns", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a(bc)--d-e-f|', { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
          const result = pipe(stream, first((x: number) => x % 2 === 0));
          expectStream(result, { strict: false }).toBe('-(b|)', { b: 2 });
        });
      });

      it("should handle very long streams efficiently", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a---------b---------c---------d|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, first((x: number) => x === 3));
          expectStream(result, { strict: false }).toBe('--------------------(c|)', { c: 3 });
        });
      });
    });

    describe("Error Handling", () => {
      it("should propagate source stream errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab#', { a: 1, b: 2 });
          const result = pipe(stream, first((x: number) => x > 5));
          expectStream(result).toBe('--#');
        });
      });

      it("should handle predicate function errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab|', { a: 1, b: 2 });
          const result = pipe(stream, first((x: number) => {
            if (x === 2) throw new Error('predicate error');
            return x > 0;
          }));
          expectStream(result).toBe('(a|)', { a: 1 });
        });
      });

      it("should handle error before any match", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('#');
          const result = pipe(stream, first());
          expectStream(result).toBe('#');
        });
      });

      it("should handle error after checking elements", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab#', { a: 1, b: 2 });
          const result = pipe(stream, first((x: number) => x > 10));
          expectStream(result).toBe('--#');
        });
      });

      it("should handle immediate error", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('#');
          const result = pipe(stream, first((x: number) => x > 0));
          expectStream(result).toBe('#');
        });
      });
    });

    describe("Stream Completion", () => {
      it("should complete after emitting first match", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, first((x: number) => x === 2));
          expectStream(result, { strict: false }).toBe('-(b|)', { b: 2 });
        });
      });

      it("should complete when source completes with no match", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, first((x: number) => x > 10));
          expectStream(result).toBe('---|');
        });
      });

      it("should complete immediately for empty source", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('|');
          const result = pipe(stream, first((x: number) => x > 0));
          expectStream(result).toBe('|');
        });
      });

      it("should handle delayed completion", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-------|', { a: 1 });
          const result = pipe(stream, first());
          expectStream(result, { strict: false }).toBe('(a|)', { a: 1 });
        });
      });

      it("should complete immediately with first element", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a--b--c|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, first());
          expectStream(result, { strict: false }).toBe('(a|)', { a: 1 });
        });
      });
    });

    describe("Data Types", () => {
      it("should handle string values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { a: 'hello', b: 'world', c: 'foo', d: 'bar' });
          const result = pipe(stream, first((x: string) => x.length > 4));
          expectStream(result, { strict: false }).toBe('(a|)', { a: 'hello' });
        });
      });

      it("should handle object values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { 
            a: { id: 1, active: false }, 
            b: { id: 2, active: true }, 
            c: { id: 3, active: false } 
          });
          const result = pipe(stream, first((x: any) => x.active));
          expectStream(result, { strict: false }).toBe('-(b|)', { b: { id: 2, active: true } });
        });
      });

      it("should handle array values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: [1], b: [1, 2], c: [1, 2, 3] });
          const result = pipe(stream, first((x: number[]) => x.length > 2));
          expectStream(result, { strict: false }).toBe('--(c|)', { c: [1, 2, 3] });
        });
      });

      it("should handle boolean values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { a: false, b: false, c: true, d: false });
          const result = pipe(stream, first((x: boolean) => x));
          expectStream(result, { strict: false }).toBe('--(c|)', { c: true });
        });
      });

      it("should handle null and undefined values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { a: null, b: undefined, c: 0, d: 'value' });
          const result = pipe(stream, first((x: any) => x != null));
          expectStream(result, { strict: false }).toBe('-b|', { b: undefined });
        });
      });

      it("should handle mixed data types", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcde|', { a: 1, b: 'hello', c: true, d: null, e: { obj: true } });
          const result = pipe(stream, first((x: any) => typeof x === 'object' && x !== null));
          expectStream(result, { strict: false }).toBe('----(e|)', { e: { obj: true } });
        });
      });
    });

    describe("Edge Cases", () => {
      it("should handle subscription timing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab^cd|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, first((x: number) => x > 2));
          expectStream(result, { strict: false }).toBe('(c|)', { c: 3 });
        });
      });

      it("should handle hot source stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab^cdef|', { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
          const result = pipe(stream, first((x: number) => x % 2 === 0));
          expectStream(result, { strict: false }).toBe('-(d|)', { d: 4 });
        });
      });

      it("should handle zero values correctly", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 0, b: 1, c: 2 });
          const result = pipe(stream, first());
          expectStream(result, { strict: false }).toBe('(a|)', { a: 0 });
        });
      });

      it("should handle false values correctly", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: false, b: true, c: false });
          const result = pipe(stream, first());
          expectStream(result, { strict: false }).toBe('(a|)', { a: false });
        });
      });

      it("should handle empty string values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: '', b: 'hello', c: 'world' });
          const result = pipe(stream, first((x: string) => x.length === 0));
          expectStream(result, { strict: false }).toBe('(a|)', { a: '' });
        });
      });

      it("should handle large numbers", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 1, b: Number.MAX_SAFE_INTEGER, c: 3 });
          const result = pipe(stream, first((x: number) => x > 1000));
          expectStream(result, { strict: false }).toBe('-(b|)', { b: Number.MAX_SAFE_INTEGER });
        });
      });

      it("should handle immediate match", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { a: 10, b: 2, c: 3, d: 4 });
          const result = pipe(stream, first((x: number) => x > 5));
          expectStream(result, { strict: false }).toBe('(a|)', { a: 10 });
        });
      });
    });

    describe("Complex Scenarios", () => {
      it("should handle complex predicate logic", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcdef|', { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
          const result = pipe(stream, first((x: number) => x > 2 && x < 5 && x % 2 === 1));
          expectStream(result, { strict: false }).toBe('--(c|)', { c: 3 });
        });
      });

      it("should handle type guard predicates", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { a: 'string', b: 42, c: true, d: 'another' });
          const result = pipe(stream, first((x: any): x is number => typeof x === 'number'));
          expectStream(result, { strict: false }).toBe('-(b|)', { b: 42 });
        });
      });

      it("should handle predicate with state", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          let count = 0;
          const stream = cold('aaaaaaa|', { a: 1 });
          const result = pipe(stream, first((x: number) => {
            count++;
            return count === 3;
          }));
          expectStream(result, { strict: false }).toBe('--(a|)', { a: 1 });
        });
      });

      it("should handle early termination scenarios", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a---------b---------c|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, first((x: number) => x === 1));
          expectStream(result, { strict: false }).toBe('(a|)', { a: 1 });
        });
      });

      it("should handle late match scenarios", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a---------b---------c|', { a: 1, b: 2, c: 100 });
          const result = pipe(stream, first((x: number) => x > 50));
          expectStream(result, { strict: false }).toBe('--------------------(c|)', { c: 100 });
        });
      });

      it("should handle alternating pattern searches", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abababab|', { a: 1, b: 2 });
          const result = pipe(stream, first((x: number) => x === 2));
          expectStream(result, { strict: false }).toBe('-(b|)', { b: 2 });
        });
      });

      it("should handle burst emissions with late match", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('(abcde)f|', { a: 1, b: 2, c: 3, d: 4, e: 5, f: 100 });
          const result = pipe(stream, first((x: number) => x > 50));
          expectStream(result, { strict: false }).toBe('-(f|)', { f: 100 });
        });
      });
    });
  });
});
