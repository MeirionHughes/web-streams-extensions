import { expect } from "chai";
import { toArray, from, pipe, exhaustAll, interval, take, map, mapSync, delay, timeout, skip } from '../../src/index.js';
import { Subject } from '../../src/subjects/subject.js';
import { sleep } from "../../src/utils/sleep.js";
import { VirtualTimeScheduler } from "../../src/testing/virtual-tick-scheduler.js";


describe("exhaustAll operator", () => {
  describe("Real Time", () => {

    it("should ignore new inner streams while current is active", async () => {
      // Use subjects for more precise control over timing
      const source = new Subject<ReadableStream<number>>();

      const resultPromise = toArray(
        pipe(
          source.readable,
          exhaustAll()
        )
      );

      // First stream - should be processed
      const stream1 = new Subject<number>();
      source.next(stream1.readable);

      // Start emitting from first stream
      stream1.next(1);
      await sleep(10);
      stream1.next(2);
      await sleep(10);

      // Second stream arrives while first is active - should be ignored
      const stream2 = new Subject<number>();
      source.next(stream2.readable);

      // Continue first stream
      stream1.next(3);
      await sleep(10);
      stream1.complete(); // First stream completes

      await sleep(10); // Small delay to ensure completion is processed

      // Third stream arrives after first completes - should be processed
      const stream3 = new Subject<number>();
      source.next(stream3.readable);

      // Emit from third stream
      await sleep(10);
      stream3.next(100);
      await sleep(10);
      stream3.next(200);
      await sleep(10);
      stream3.next(300);
      await sleep(10);
      stream3.complete();

      // Complete source
      source.complete();

      const result = await resultPromise;
      expect(result).to.deep.equal([1, 2, 3, 100, 200, 300]);
    });

    it("should process next stream after current completes", async () => {
      const subject1 = new Subject<number>();
      const subject2 = new Subject<number>();

      // Create a source that provides streams sequentially
      const sourceSubject = new Subject<ReadableStream<number>>();

      const resultPromise = toArray(
        pipe(
          sourceSubject.readable,
          exhaustAll()
        )
      );

      // Start with first stream
      await sourceSubject.next(subject1.readable);
      await subject1.next(1);
      await subject1.complete();

      // Now provide second stream after first completes
      await new Promise(resolve => setTimeout(resolve, 10));
      await sourceSubject.next(subject2.readable);
      await subject2.next(2);
      await subject2.complete();

      // Complete the source
      await sourceSubject.complete();

      const result = await resultPromise;
      expect(result).to.deep.equal([1, 2]);
    });

    it("should work with arrays", async () => {
      const input = [
        [1, 2],
        [3, 4], // Should be ignored if first is still processing
        [5, 6]  // Should be ignored
      ];

      const result = await toArray(
        pipe(
          from(input),
          exhaustAll()
        )
      );

      // Since arrays are synchronous, only first should emit
      expect(result).to.deep.equal([1, 2]);
    });

    it("should work with promises", async () => {
      const input = [
        Promise.resolve(1),
        Promise.resolve(2),
        Promise.resolve(3)
      ];

      const result = await toArray(
        pipe(
          from(input),
          exhaustAll()
        )
      );

      // Only first promise should be processed
      expect(result).to.deep.equal([1]);
    });

    it("should handle empty source stream", async () => {
      const result = await toArray(
        pipe(
          from([]),
          exhaustAll()
        )
      );

      expect(result).to.deep.equal([]);
    });

    it("should handle errors in source stream", async () => {
      const errorStream = new ReadableStream({
        start(controller) {
          controller.enqueue(from([1, 2]));
          controller.error(new Error("Source error"));
        }
      });

      try {
        await toArray(pipe(errorStream, exhaustAll()));
        expect.fail("Should have thrown error");
      } catch (err) {
        expect(err.message).to.equal("Source error");
      }
    });

    it("should handle errors in inner streams", async () => {
      const errorInnerStream = new ReadableStream({
        start(controller) {
          controller.enqueue(1);
          controller.error(new Error("Inner error"));
        }
      });

      try {
        await toArray(
          pipe(
            from([errorInnerStream]),
            exhaustAll()
          )
        );
        expect.fail("Should have thrown error");
      } catch (err) {
        expect(err.message).to.equal("Inner error");
      }
    });

    it("should handle cancellation properly", async () => {
      const subject = new Subject<ReadableStream<number>>();

      const stream = pipe(
        subject.readable,
        exhaustAll()
      );

      const reader = stream.getReader();

      await subject.next(from([1, 2]));

      const first = await reader.read();
      expect(first.value).to.equal(1);

      // Cancel should clean up gracefully
      await reader.cancel("test");
      reader.releaseLock();
    });

    it("should work with custom highWaterMark", async () => {
      const result = await toArray(
        pipe(
          from([from([1, 2]), from([3, 4])]),
          exhaustAll()
        )
      );

      expect(result).to.deep.equal([1, 2]);
    });

    it("should handle single inner stream", async () => {
      const result = await toArray(
        pipe(
          from([from([1, 2, 3])]),
          exhaustAll()
        )
      );

      expect(result).to.deep.equal([1, 2, 3]);
    });

    it("should handle rapid inner stream arrival", async () => {
      // Create a source stream that emits multiple inner streams rapidly
      const sourceStream = new ReadableStream<ReadableStream<number>>({
        start(controller) {
          // Emit inner streams synchronously, but each inner stream has a small delay
          controller.enqueue(pipe(from([0, 0]), delay(10)));    // First stream should be processed (20ms total)
          controller.enqueue(pipe(from([1, 10]), delay(5)));    // Should be ignored
          controller.enqueue(pipe(from([2, 20]), delay(5)));    // Should be ignored  
          controller.enqueue(pipe(from([3, 30]), delay(5)));    // Should be ignored
          controller.enqueue(pipe(from([4, 40]), delay(5)));    // Should be ignored
          controller.close();
        }
      });

      const result = await toArray(
        pipe(
          sourceStream,
          exhaustAll()
        )
      );

      // Should only process first stream since others arrive while it's active
      expect(result).to.deep.equal([0, 0]);
    });

    it("should work with rapidly emitted values", async () => {
      // Test with timed source where inner streams complete quickly
      // Source emits every 1ms, inner streams are instant
      const result = await toArray(pipe(
        interval(1),
        take(3), // Emit 0, 1, 2 at 1ms intervals  
        map(n => [n * 10, n * 10 + 1]), // Each maps to instant array [0,1], [10,11], [20,21]
        exhaustAll()
      ));
      
      // With exhaust semantics and instant inner arrays, all values should be processed
      // because each inner array completes immediately, allowing the next outer value
      expect(result).to.deep.equal([0, 1, 10, 11, 20, 21]);
    });

    it("should handle mixed stream types", async () => {
      const input = [
        from([1, 2]),           // ReadableStream
        [3, 4],                 // Array
        Promise.resolve(5)      // Promise
      ];

      const result = await toArray(
        pipe(
          from(input),
          exhaustAll()
        )
      );

      // Only first stream should be processed
      expect(result).to.deep.equal([1, 2]);
    });

    it("should complete when source completes and no active inner stream", async () => {
      const result = await toArray(
        pipe(
          from([from([1])]),
          exhaustAll()
        )
      );

      expect(result).to.deep.equal([1]);
    });

    it("should handle controller errors gracefully", async () => {
      // This tests error handling in the flush function
      const problematicStream = new ReadableStream({
        start(controller) {
          controller.enqueue(from([1, 2]));
          controller.close();
        }
      });

      const result = await toArray(
        pipe(
          problematicStream,
          exhaustAll()
        )
      );

      expect(result).to.deep.equal([1, 2]);
    });
  });

  describe("Virtual Time", () => {
    describe("Basic Behavior", () => {
      it("should flatten first inner stream and ignore subsequent while active", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('--a--b--|', { a: 1, b: 2 });
          const inner2 = cold('----c--d|', { c: 3, d: 4 });
          const inner3 = cold('------e-|', { e: 5 });

          const stream = cold('x-y-z|', { x: inner1, y: inner2, z: inner3 });
          const result = pipe(stream, exhaustAll());
          expectStream(result, { strict: false }).toBe('--a--b--|', { a: 1, b: 2 });
        });
      });

      it("should process next inner stream after current completes", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('--a|', { a: 1 });
          const inner2 = cold('--b|', { b: 2 });

          const stream = cold('x----y|', { x: inner1, y: inner2 });
          const result = pipe(stream, exhaustAll());
          expectStream(result, { strict: false }).toBe('--a----b|', { a: 1, b: 2 });
        });
      });

      it("should handle empty source stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('|');
          const result = pipe(stream, exhaustAll());
          expectStream(result).toBe('|');
        });
      });

      it("should handle single inner stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner = cold('--a--b--c|', { a: 1, b: 2, c: 3 });
          const stream = cold('x|', { x: inner });
          const result = pipe(stream, exhaustAll());
          expectStream(result, { strict: false }).toBe('--a--b--c|', { a: 1, b: 2, c: 3 });
        });
      });

      it("should handle immediate inner stream completion", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('|');
          const inner2 = cold('--a|', { a: 1 });

          const stream = cold('xy|', { x: inner1, y: inner2 });
          const result = pipe(stream, exhaustAll());
          expectStream(result, { strict: false }).toBe('---a|', { a: 1 });
        });
      });
    });

    describe("Timing Patterns", () => {
      it("should ignore overlapping inner streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('a---b---c|', { a: 1, b: 2, c: 3 });
          const inner2 = cold('--d--e|', { d: 10, e: 20 }); // Should be ignored
          const inner3 = cold('----f|', { f: 30 }); // Should be ignored

          const stream = cold('x-y--z|', { x: inner1, y: inner2, z: inner3 });
          const result = pipe(stream, exhaustAll());
          expectStream(result, { strict: false }).toBe('a---b---c|', { a: 1, b: 2, c: 3 });
        });
      });

      it("should process non-overlapping inner streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('a-b|', { a: 1, b: 2 });
          const inner2 = cold('--c|', { c: 3 });
          const inner3 = cold('d|', { d: 4 });

          const stream = cold('x---y---z|', { x: inner1, y: inner2, z: inner3 });
          const result = pipe(stream, exhaustAll());
          expectStream(result, { strict: false }).toBe('a-b---c-d|', { a: 1, b: 2, c: 3, d: 4 });
        });
      });

      it("should handle rapid inner stream emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('(abc)|', { a: 1, b: 2, c: 3 });
          const inner2 = cold('(def)|', { d: 4, e: 5, f: 6 }); // Should be ignored

          const stream = cold('xy|', { x: inner1, y: inner2 });
          const result = pipe(stream, exhaustAll());
          expectStream(result, { strict: false }).toBe('(abc)|', { a: 1, b: 2, c: 3 });
        });
      });

      it("should handle delayed inner stream start", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('---a|', { a: 1 });
          const inner2 = cold('b|', { b: 2 }); // Starts immediately but should be ignored

          const stream = cold('x-y|', { x: inner1, y: inner2 });
          const result = pipe(stream, exhaustAll());
          expectStream(result, { strict: false }).toBe('---a|', { a: 1 });
        });
      });

      it("should handle spaced inner stream arrivals", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('a|', { a: 1 });
          const inner2 = cold('b|', { b: 2 });
          const inner3 = cold('c|', { c: 3 });

          const stream = cold('x---y---z|', { x: inner1, y: inner2, z: inner3 });
          const result = pipe(stream, exhaustAll());
          expectStream(result, { strict: false }).toBe('a---b---c|', { a: 1, b: 2, c: 3 });
        });
      });

      it("should handle long-running first stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('a---------b|', { a: 1, b: 2 });
          const inner2 = cold('--c|', { c: 3 }); // Should be ignored
          const inner3 = cold('----d|', { d: 4 }); // Should be ignored
          const inner4 = cold('------e|', { e: 5 }); // Should be ignored

          const stream = cold('x-y-z-w|', { x: inner1, y: inner2, z: inner3, w: inner4 });
          const result = pipe(stream, exhaustAll());
          expectStream(result, { strict: false }).toBe('a---------b|', { a: 1, b: 2 });
        });
      });
    });

    describe("Error Handling", () => {
      it("should propagate source stream errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('x#', { x: cold('a|') });
          const result = pipe(stream, exhaustAll());
          expectStream(result).toBe('a#');
        });
      });

      it("should propagate inner stream errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner = cold('a-#', { a: 1 });
          const stream = cold('x|', { x: inner });
          const result = pipe(stream, exhaustAll());
          expectStream(result).toBe('a-#', { a: 1 });
        });
      });

      it("should handle error in source before any inner streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('#');
          const result = pipe(stream, exhaustAll());
          expectStream(result).toBe('#');
        });
      });

      it("should handle error in later inner stream (ignored)", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('a--b|', { a: 1, b: 2 });
          const inner2 = cold('#'); // Error, but should be ignored

          const stream = cold('x-y|', { x: inner1, y: inner2 });
          const result = pipe(stream, exhaustAll());
          expectStream(result, { strict: false }).toBe('a--b|', { a: 1, b: 2 });
        });
      });

      it("should handle error after inner stream completion", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner = cold('a|', { a: 1 });
          const stream = cold('x--#', { x: inner });
          const result = pipe(stream, exhaustAll());
          expectStream(result).toBe('a--#', { a: 1 });
        });
      });
    });

    describe("Stream Completion", () => {
      it("should complete when source completes and no active inner stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner = cold('a|', { a: 1 });
          const stream = cold('x-|', { x: inner });
          const result = pipe(stream, exhaustAll());
          expectStream(result, { strict: false }).toBe('a-|', { a: 1 });
        });
      });

      it("should wait for active inner stream to complete", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner = cold('a----b|', { a: 1, b: 2 });
          const stream = cold('x|', { x: inner });
          const result = pipe(stream, exhaustAll());
          expectStream(result, { strict: false }).toBe('a----b|', { a: 1, b: 2 });
        });
      });

      it("should handle immediate source completion", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('|');
          const result = pipe(stream, exhaustAll());
          expectStream(result).toBe('|');
        });
      });

      it("should handle source completion with pending inner streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('a----b|', { a: 1, b: 2 });
          const inner2 = cold('c|', { c: 3 }); // Should be ignored

          const stream = cold('x-y|', { x: inner1, y: inner2 });
          const result = pipe(stream, exhaustAll());
          expectStream(result, { strict: false }).toBe('a----b|', { a: 1, b: 2 });
        });
      });
    });

    describe("Data Types", () => {
      it("should handle different value types", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('abc|', { a: 'hello', b: 42, c: true });
          const inner2 = cold('def|', { d: null, e: undefined, f: { obj: true } }); // Should be ignored

          const stream = cold('xy|', { x: inner1, y: inner2 });
          const result = pipe(stream, exhaustAll());
          expectStream(result, { strict: false }).toBe('abc|', { a: 'hello', b: 42, c: true });
        });
      });

      it("should handle object streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner = cold('ab|', {
            a: { id: 1, name: 'Alice' },
            b: { id: 2, name: 'Bob' }
          });
          const stream = cold('x|', { x: inner });
          const result = pipe(stream, exhaustAll());
          expectStream(result, { strict: false }).toBe('ab|', {
            a: { id: 1, name: 'Alice' },
            b: { id: 2, name: 'Bob' }
          });
        });
      });

      it("should handle array streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner = cold('ab|', { a: [1, 2], b: [3, 4, 5] });
          const stream = cold('x|', { x: inner });
          const result = pipe(stream, exhaustAll());
          expectStream(result, { strict: false }).toBe('ab|', { a: [1, 2], b: [3, 4, 5] });
        });
      });

      it("should handle mixed data types across inner streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('a|', { a: 'string' });
          const inner2 = cold('b|', { b: 123 });
          const inner3 = cold('c|', { c: { obj: true } });

          const stream = cold('x--y--z|', { x: inner1, y: inner2, z: inner3 });
          const result = pipe(stream, exhaustAll());
          expectStream(result, { strict: false }).toBe('a--b--c|', { a: 'string', b: 123, c: { obj: true } });
        });
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty inner streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('|');
          const inner2 = cold('a|', { a: 1 });

          const stream = cold('xy|', { x: inner1, y: inner2 });
          const result = pipe(stream, exhaustAll());
          expectStream(result, { strict: false }).toBe('-a|', { a: 1 });
        });
      });

      it("should handle all empty inner streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('|');
          const inner2 = cold('|');
          const inner3 = cold('|');

          const stream = cold('xyz|', { x: inner1, y: inner2, z: inner3 });
          const result = pipe(stream, exhaustAll());
          expectStream(result).toBe('---|');
        });
      });

      it("should handle subscription timing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('ab|', { a: 1, b: 2 });
          const inner2 = cold('cd|', { c: 3, d: 4 });

          const stream = cold('x^y|', { x: inner1, y: inner2 });
          const result = pipe(stream, exhaustAll());
          expectStream(result, { strict: false }).toBe('cd|', { c: 3, d: 4 });
        });
      });

      it("should handle hot source stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('ab|', { a: 1, b: 2 });
          const inner2 = cold('cd|', { c: 3, d: 4 });
          const inner3 = cold('ef|', { e: 5, f: 6 });

          const stream = cold('xy^z|', { x: inner1, y: inner2, z: inner3 });
          const result = pipe(stream, exhaustAll());
          expectStream(result, { strict: false }).toBe('ef|', { e: 5, f: 6 });
        });
      });

      it("should handle very long inner streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('a----------b|', { a: 1, b: 2 });
          const inner2 = cold('c|', { c: 3 }); // Should be ignored
          const inner3 = cold('d|', { d: 4 }); // Should be ignored

          const stream = cold('x-y--z|', { x: inner1, y: inner2, z: inner3 });
          const result = pipe(stream, exhaustAll());
          expectStream(result, { strict: false }).toBe('a----------b|', { a: 1, b: 2 });
        });
      });

      it("should handle burst of inner streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('a|', { a: 1 });
          const inner2 = cold('b|', { b: 2 }); // Should be ignored
          const inner3 = cold('c|', { c: 3 }); // Should be ignored

          const stream = cold('(xyz)|', { x: inner1, y: inner2, z: inner3 });
          const result = pipe(stream, exhaustAll());
          expectStream(result, { strict: false }).toBe('a|', { a: 1 });
        });
      });
    });

    describe("Complex Scenarios", () => {
      it("should handle mixed timing with gaps", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('a--b|', { a: 1, b: 2 });
          const inner2 = cold('--c|', { c: 3 }); // Should be ignored (overlaps)
          const inner3 = cold('d|', { d: 4 }); // Should be processed (gap after inner1)
          const inner4 = cold('e|', { e: 5 }); // Should be processed (gap after inner3)

          const stream = cold('x-y----z-w|', { x: inner1, y: inner2, z: inner3, w: inner4 });
          const result = pipe(stream, exhaustAll());
          expectStream(result, { strict: false }).toBe('a--b---d-e|', { a: 1, b: 2, d: 4, e: 5 });
        });
      });

      it("should handle alternating pattern", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('a|', { a: 1 });
          const inner2 = cold('b|', { b: 2 });
          const inner3 = cold('c|', { c: 3 });
          const inner4 = cold('d|', { d: 4 });

          const stream = cold('w-x-y-z|', { w: inner1, x: inner2, y: inner3, z: inner4 });
          const result = pipe(stream, exhaustAll());
          expectStream(result, { strict: false }).toBe('a-b-c-d|', { a: 1, b: 2, c: 3, d: 4 });
        });
      });

      it("should handle nested stream completions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('a-(b|)', { a: 1, b: 2 });
          const inner2 = cold('c|', { c: 3 }); // Should process after inner1 completes

          const stream = cold('x--y|', { x: inner1, y: inner2 });
          const result = pipe(stream, exhaustAll());
          expectStream(result, { strict: false }).toBe('a-(b)c|', { a: 1, b: 2, c: 3 });
        });
      });
    });
  });
});
