import { expect } from "chai";
import { from, pipe, last, toArray, toPromise, Subject } from "../../src/index.js";
import { parseMarbles } from "../../src/testing/parse-marbles.js";
import { VirtualTimeScheduler } from "../../src/testing/virtual-tick-scheduler.js";


describe("last", () => {
  describe("Real Time", () => {
    it("should get the last element of stream", async () => {
      const input = [1, 2, 3, 4];
      
      const result = await toPromise(pipe(
        from(input),
        last()
      ));
      
      expect(result).to.equal(4);
    });

    it("should work with single element", async () => {
      const input = [42];
      
      const result = await toPromise(pipe(
        from(input),
        last()
      ));
      
      expect(result).to.equal(42);
    });

    it("should handle empty stream", async () => {
      const input: number[] = [];
      
      const result = await toArray(pipe(
        from(input),
        last()
      ));
      
      // Empty stream results in empty output
      expect(result).to.deep.equal([]);
    });

    it("should get last element matching predicate", async () => {
      const input = [1, 2, 3, 4, 5, 6];
      
      const result = await toArray(pipe(
        from(input),
        last((x: number) => x % 2 === 0) // last even number
      ));
      
      expect(result).to.deep.equal([6]);
    });

    it("should handle no elements matching predicate", async () => {
      const input = [1, 3, 5, 7];
      
      const result = await toArray(pipe(
        from(input),
        last((x: number) => x % 2 === 0) // no even numbers
      ));
      
      // No matching elements results in empty output
      expect(result).to.deep.equal([]);
    });

    it("should work with complex predicate", async () => {
      const input = [1, 2, 3, 4, 5];
      
      const result = await toPromise(pipe(
        from(input),
        last((x: number) => x > 3)
      ));
      
      expect(result).to.equal(5);
    });

    it("should handle predicate errors", async () => {
      const input = [1, 2, 3, 4];
      
      try {
        await toPromise(pipe(
          from(input),
          last((x: number) => {
            if (x === 3) throw new Error("Predicate error");
            return x > 2;
          })
        ));
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).to.equal("Predicate error");
      }
    });

    it("should work with different types", async () => {
      const input = ['apple', 'banana', 'cherry', 'date'];
      
      const result = await toPromise(pipe(
        from(input),
        last((s: string) => s.length > 5)
      ));
      
      expect(result).to.equal('cherry');
    });

    it("should handle async streams", async () => {
      const subject = new Subject<number>();
      
      const resultPromise = toPromise(pipe(
        subject.readable,
        last()
      ));
      
      subject.next(1);
      subject.next(2);
      subject.next(3);
      subject.complete();
      
      const result = await resultPromise;
      expect(result).to.equal(3);
    });

    it("should handle stream errors", async () => {
      const subject = new Subject<number>();
      
      const resultPromise = toPromise(pipe(
        subject.readable,
        last()
      ));
      
      subject.next(1);
      subject.error(new Error("Stream error"));
      
      try {
        await resultPromise;
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).to.equal("Stream error");
      }
    });

    it("should handle cancellation", async () => {
      const stream = pipe(
        from([1, 2, 3, 4, 5]),
        last()
      );

      const reader = stream.getReader();
      
      // Cancel the stream
      await reader.cancel('User cancelled');
      // If we get here, cancellation was handled
      expect(true).to.be.true;
    });

    it("should handle cleanup errors during cancellation", async () => {
      // Create a stream that throws on cancel
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(1);
          controller.enqueue(2);
          controller.enqueue(3);
          // Don't close to force cancellation
        },
        cancel() {
          throw new Error('Cancel error');
        }
      });

      const stream = pipe(mockStream, last());
      const reader = stream.getReader();
      
      // Should handle cancel errors gracefully
      await reader.cancel('test cancel');
      // If we get here, it handled the cleanup error
      expect(true).to.be.true;
    });

    it("should handle cleanup errors during error", async () => {
      // Create a stream that throws on both read and cancel
      const errorStream = new ReadableStream({
        start(controller) {
          controller.enqueue(1);
          controller.error(new Error('Stream error'));
        },
        cancel() {
          throw new Error('Cancel error');
        }
      });

      try {
        await toArray(pipe(errorStream, last()));
        expect.fail('Expected stream to throw error');
      } catch (err: any) {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('Stream error');
      }
    });

    it("should work with custom highWaterMark", async () => {
      const result = await toArray(
        pipe(
          from([1, 2, 3, 4, 5]),
          (src) => last()(src, { highWaterMark: 1 })
        )
      );

      expect(result).to.deep.equal([5]);
    });

    it("should handle multiple matching values", async () => {
      const input = [1, 2, 4, 6, 8, 10];
      
      const result = await toArray(pipe(
        from(input),
        last((x: number) => x % 2 === 0) // last even number
      ));
      
      expect(result).to.deep.equal([10]); // Should get only the last matching value
    });

    it("should handle default selector", async () => {
      const input = [1, 2, 3, 4, 5];
      
      const result = await toArray(pipe(
        from(input),
        last() // Default selector returns true for all
      ));
      
      expect(result).to.deep.equal([5]);
    });

    it("should handle boolean values", async () => {
      const input = [true, false, true, false];
      
      const result = await toArray(pipe(
        from(input),
        last((x: boolean) => x === true)
      ));
      
      expect(result).to.deep.equal([true]);
    });

    it("should handle null and undefined values", async () => {
      const input = [1, null, 2, undefined, 3];
      
      const result = await toArray(pipe(
        from(input),
        last((x: any) => x != null)
      ));
      
      expect(result).to.deep.equal([3]);
    });

    it("should handle stream with only non-matching values", async () => {
      const input = [1, 3, 5, 7, 9];
      
      const result = await toArray(pipe(
        from(input),
        last((x: number) => x % 2 === 0) // no even numbers
      ));
      
      expect(result).to.deep.equal([]);
    });

    it("should handle early reader cancellation scenario", async () => {
      const stream = pipe(
        from([1, 2, 3]),
        last()
      );

      // This tests the reader cancellation path during processing
      const reader = stream.getReader();
      reader.cancel('early cancel');
      
      // Just ensure this doesn't throw
      expect(true).to.be.true;
    });
  });

  describe("Virtual Time", () => {
    describe("Basic Behavior", () => {
      it("should return last element without predicate", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcde|', { a: 1, b: 2, c: 3, d: 4, e: 5 });
          const result = pipe(stream, last());
          expectStream(result, { strict: false }).toBe('-----(e|)', { e: 5 });
        });
      });

      it("should return last element matching predicate", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcde|', { a: 1, b: 2, c: 3, d: 4, e: 5 });
          const result = pipe(stream, last((x: number) => x % 2 === 0));
          expectStream(result, { strict: false }).toBe('-----(d|)', { d: 4 });
        });
      });

      it("should handle empty source stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('|');
          const result = pipe(stream, last());
          expectStream(result).toBe('|');
        });
      });

      it("should handle single element stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a|', { a: 42 });
          const result = pipe(stream, last());
          expectStream(result, { strict: false }).toBe('-(a|)', { a: 42 });
        });
      });

      it("should handle no matching elements", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { a: 1, b: 3, c: 5, d: 7 });
          const result = pipe(stream, last((x: number) => x % 2 === 0));
          expectStream(result).toBe('----|');
        });
      });

      it("should complete only after source completion", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a--b--c--d|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, last((x: number) => x === 2));
          expectStream(result, { strict: false }).toBe('----------(b|)', { b: 2 });
        });
      });
    });

    describe("Timing Patterns", () => {
      it("should wait for stream completion before emitting last value", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('---a--b--c|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, last((x: number) => x === 2));
          expectStream(result, { strict: false }).toBe('----------(b|)', { b: 2 });
        });
      });

      it("should handle rapid emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('(abcde)|', { a: 1, b: 2, c: 3, d: 4, e: 5 });
          const result = pipe(stream, last((x: number) => x > 3));
          expectStream(result, { strict: false }).toBe('-(e|)', { e: 5 });
        });
      });

      it("should handle spaced emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-----b-----c|', { a: 10, b: 5, c: 15 });
          const result = pipe(stream, last((x: number) => x < 20));
          expectStream(result, { strict: false }).toBe('-------------(c|)', { c: 15 });
        });
      });

      it("should handle delayed start", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('------a--b--c|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, last());
          expectStream(result, { strict: false }).toBe('-------------(c|)', { c: 3 });
        });
      });

      it("should handle mixed timing patterns", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a(bc)--d-e-f|', { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
          const result = pipe(stream, last((x: number) => x % 2 === 0));
          expectStream(result, { strict: false }).toBe('---------(f|)', { f: 6 });
        });
      });

      it("should handle very long streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a---------b---------c---------d|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, last((x: number) => x === 3));
          expectStream(result, { strict: false }).toBe('-------------------------------(c|)', { c: 3 });
        });
      });
    });

    describe("Error Handling", () => {
      it("should propagate source stream errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab#', { a: 1, b: 2 });
          const result = pipe(stream, last((x: number) => x > 0));
          expectStream(result).toBe('--#');
        });
      });

      it("should handle predicate function errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab|', { a: 1, b: 2 });
          const result = pipe(stream, last((x: number) => {
            if (x === 2) throw new Error('predicate error');
            return x > 0;
          }));
          expectStream(result).toBe('-#', undefined, new Error('predicate error'));
        });
      });

      it("should handle error before any emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('#');
          const result = pipe(stream, last());
          expectStream(result).toBe('#');
        });
      });

      it("should handle error after checking elements", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab#', { a: 1, b: 2 });
          const result = pipe(stream, last((x: number) => x > 10));
          expectStream(result).toBe('--#');
        });
      });

      it("should handle immediate error", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('#');
          const result = pipe(stream, last((x: number) => x > 0));
          expectStream(result).toBe('#');
        });
      });
    });

    describe("Stream Completion", () => {
      it("should complete after emitting last match", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, last((x: number) => x === 2));
          expectStream(result, { strict: false }).toBe('---(b|)', { b: 2 });
        });
      });

      it("should complete when source completes with no match", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, last((x: number) => x > 10));
          expectStream(result).toBe('---|');
        });
      });

      it("should complete immediately for empty source", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('|');
          const result = pipe(stream, last((x: number) => x > 0));
          expectStream(result).toBe('|');
        });
      });

      it("should handle delayed completion", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-------|', { a: 1 });
          const result = pipe(stream, last());
          expectStream(result, { strict: false }).toBe('--------(a|)', { a: 1 });
        });
      });

      it("should emit last element at completion time", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a--b--c--d--|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, last());
          expectStream(result, { strict: false }).toBe('------------(d|)', { d: 4 });
        });
      });
    });

    describe("Data Types", () => {
      it("should handle string values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { a: 'hello', b: 'world', c: 'foo', d: 'bar' });
          const result = pipe(stream, last((x: string) => x.length > 3));
          expectStream(result, { strict: false }).toBe('----(b|)', { b: 'world' });
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
          const result = pipe(stream, last((x: any) => x.active));
          expectStream(result, { strict: false }).toBe('---(b|)', { b: { id: 2, active: true } });
        });
      });

      it("should handle array values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: [1], b: [1, 2], c: [1, 2, 3] });
          const result = pipe(stream, last((x: number[]) => x.length > 1));
          expectStream(result, { strict: false }).toBe('---(c|)', { c: [1, 2, 3] });
        });
      });

      it("should handle boolean values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { a: false, b: true, c: false, d: true });
          const result = pipe(stream, last((x: boolean) => x));
          expectStream(result, { strict: false }).toBe('----(d|)', { d: true });
        });
      });

      it("should handle null and undefined values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { a: null, b: undefined, c: 0, d: 'value' });
          const result = pipe(stream, last((x: any) => x != null));
          expectStream(result, { strict: false }).toBe('----(d|)', { d: 'value' });
        });
      });

      it("should handle mixed data types", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcde|', { a: 1, b: 'hello', c: true, d: null, e: { obj: true } });
          const result = pipe(stream, last((x: any) => typeof x === 'object' && x !== null));
          expectStream(result, { strict: false }).toBe('-----(e|)', { e: { obj: true } });
        });
      });
    });

    describe("Edge Cases", () => {
      it("should handle subscription timing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab^cd|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, last((x: number) => x > 2));
          expectStream(result, { strict: false }).toBe('--(d|)', { d: 4 });
        });
      });

      it("should handle hot source stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab^cdef|', { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
          const result = pipe(stream, last((x: number) => x % 2 === 0));
          expectStream(result, { strict: false }).toBe('----(f|)', { f: 6 });
        });
      });

      it("should handle zero values correctly", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 0, b: 1, c: 2 });
          const result = pipe(stream, last());
          expectStream(result, { strict: false }).toBe('---(c|)', { c: 2 });
        });
      });

      it("should handle false values correctly", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: false, b: true, c: false });
          const result = pipe(stream, last());
          expectStream(result, { strict: false }).toBe('---(c|)', { c: false });
        });
      });

      it("should handle empty string values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: '', b: 'hello', c: 'world' });
          const result = pipe(stream, last((x: string) => x.length === 0));
          expectStream(result, { strict: false }).toBe('---(a|)', { a: '' });
        });
      });

      it("should handle large numbers", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 1, b: Number.MAX_SAFE_INTEGER, c: 3 });
          const result = pipe(stream, last((x: number) => x > 1000));
          expectStream(result, { strict: false }).toBe('---(b|)', { b: Number.MAX_SAFE_INTEGER });
        });
      });

      it("should handle last match correctly", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { a: 10, b: 2, c: 3, d: 4 });
          const result = pipe(stream, last((x: number) => x > 5));
          expectStream(result, { strict: false }).toBe('----(a|)', { a: 10 });
        });
      });
    });

    describe("Complex Scenarios", () => {
      it("should handle complex predicate logic", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcdef|', { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
          const result = pipe(stream, last((x: number) => x > 2 && x < 5 && x % 2 === 1));
          expectStream(result, { strict: false }).toBe('------(c|)', { c: 3 });
        });
      });

      it("should handle type guard predicates", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { a: 'string', b: 42, c: true, d: 'another' });
          const result = pipe(stream, last((x: any): x is string => typeof x === 'string'));
          expectStream(result, { strict: false }).toBe('----(d|)', { d: 'another' });
        });
      });

      it("should handle predicate with state", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          let count = 0;
          const stream = cold('aaaaaaa|', { a: 1 });
          const result = pipe(stream, last((x: number) => {
            count++;
            return count > 3;
          }));
          expectStream(result, { strict: false }).toBe('-------(a|)', { a: 1 });
        });
      });

      it("should handle multiple matching values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a---------b---------c|', { a: 2, b: 4, c: 6 });
          const result = pipe(stream, last((x: number) => x % 2 === 0));
          expectStream(result, { strict: false }).toBe('---------------------(c|)', { c: 6 });
        });
      });

      it("should handle late matching scenarios", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a---------b---------c|', { a: 1, b: 2, c: 100 });
          const result = pipe(stream, last((x: number) => x > 50));
          expectStream(result, { strict: false }).toBe('---------------------(c|)', { c: 100 });
        });
      });

      it("should handle alternating pattern searches", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abababab|', { a: 1, b: 2 });
          const result = pipe(stream, last((x: number) => x === 2));
          expectStream(result, { strict: false }).toBe('--------(b|)', { b: 2 });
        });
      });

      it("should handle burst emissions with last match", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('(abcde)f|', { a: 1, b: 2, c: 3, d: 4, e: 5, f: 100 });
          const result = pipe(stream, last((x: number) => x > 50));
          expectStream(result, { strict: false }).toBe('--(f|)', { f: 100 });
        });
      });

      it("should handle overlapping criteria", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcdef|', { a: 2, b: 4, c: 1, d: 6, e: 3, f: 8 });
          const result = pipe(stream, last((x: number) => x % 2 === 0 && x > 2));
          expectStream(result, { strict: false }).toBe('------(f|)', { f: 8 });
        });
      });
    });
  });
});
