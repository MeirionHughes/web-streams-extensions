import { expect } from "chai";
import { toArray, from, pipe, buffer, concatAll } from '../../src/index.js';
import { Subject } from '../../src/subjects/subject.js';
import { VirtualTimeScheduler } from '../../src/testing/virtual-tick-scheduler.js';


describe("concatAll operator", () => {
  describe("Real Time", () => {
    it("can concatenate stream of streams ", async () => {
      let input = [from([1, 2]), from([3, 4]), from([5])];
      let expected = [1, 2, 3, 4, 5]

      let result = await toArray(
        pipe(
          from(input),
          concatAll())
      );

      expect(result, "stream result matches expected").to.be.deep.eq(expected);
    })

  it("can concatenate stream of promises ", async () => {
    let input = from([Promise.resolve(1), Promise.resolve(2)])
    let expected = [1, 2]

    let result = await toArray(
      pipe(
        input,
        concatAll())
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  }) 
  
  it("can concatenate stream of arrays ", async () => {
    let input = from([[1,2,3], [4,5,6]])
    let expected = [1, 2, 3, 4, 5, 6]

    let result = await toArray(
      pipe(
        input,
        concatAll())
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })

  it("should handle empty source stream", async () => {
    let result = await toArray(
      pipe(
        from([]),
        concatAll()
      )
    );

    expect(result).to.deep.equal([]);
  })

  it("should handle empty arrays", async () => {
    let input = [[], [1, 2], []];
    let expected = [1, 2];

    let result = await toArray(
      pipe(
        from(input),
        concatAll()
      )
    );

    expect(result).to.deep.equal(expected);
  })

  it("should handle cleanup errors during cancel", async () => {
    const subject = new Subject<ReadableStream<number>>();
    
    const stream = pipe(
      subject.readable,
      concatAll()
    );
    
    const reader = stream.getReader();
    
    await subject.next(from([1, 2]));
    
    const first = await reader.read();
    expect(first.value).to.equal(1);
    
    // Cancel should handle cleanup gracefully
    await reader.cancel("test");
    reader.releaseLock();
  })

  it("should process streams sequentially, not concurrently", async () => {
    const subject1 = new Subject<number>();
    const subject2 = new Subject<number>();
    
    const resultPromise = toArray(
      pipe(
        from([subject1.readable, subject2.readable]),
        concatAll()
      )
    );
    
    // Emit to second stream first, but it shouldn't appear until first completes
    await subject2.next(3);
    await subject2.next(4);
    
    // Now complete first stream
    await subject1.next(1);
    await subject1.next(2);
    await subject1.complete();
    
    // Complete second stream
    await subject2.complete();
    
    const result = await resultPromise;
    expect(result).to.deep.equal([1, 2, 3, 4]); // Sequential order maintained
  })

  it("should handle very long sequence of inner streams", async () => {
    const streams = Array.from({ length: 100 }, (_, i) => from([i]));
    const expected = Array.from({ length: 100 }, (_, i) => i);

    const result = await toArray(
      pipe(
        from(streams),
        concatAll()
      )
    );

    expect(result).to.deep.equal(expected);
  })
  });

  describe("Virtual Time", () => {
    describe("Basic Behavior", () => {
      it("should handle empty stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('|');
          const result = pipe(stream, concatAll());
          expectStream(result).toBe('|');
        });
      });

      it("should concatenate inner streams sequentially", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('ab|', { a: 1, b: 2 });
          const inner2 = cold('cd|', { c: 3, d: 4 });
          const inner3 = cold('e|', { e: 5 });
          
          const stream = cold('xyz|', { x: inner1, y: inner2, z: inner3 });
          const result = pipe(stream, concatAll());
          expectStream(result).toBe('abcde|', { a: 1, b: 2, c: 3, d: 4, e: 5 });
        });
      });

      it("should handle single inner stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner = cold('abc|', { a: 1, b: 2, c: 3 });
          const stream = cold('x|', { x: inner });
          const result = pipe(stream, concatAll());
          expectStream(result).toBe('abc|', { a: 1, b: 2, c: 3 });
        });
      });

      it("should handle empty inner streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('|');
          const inner2 = cold('ab|', { a: 1, b: 2 });
          const inner3 = cold('|');
          
          const stream = cold('xyz|', { x: inner1, y: inner2, z: inner3 });
          const result = pipe(stream, concatAll());
          expectStream(result).toBe('-ab|', { a: 1, b: 2 });
        });
      });
    });

    describe("Timing Patterns", () => {
      it("should preserve timing within inner streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('a-b|', { a: 1, b: 2 });
          const inner2 = cold('c-d|', { c: 3, d: 4 });
          
          const stream = cold('xy|', { x: inner1, y: inner2 });
          const result = pipe(stream, concatAll());
          expectStream(result).toBe('a-bc-d|', { a: 1, b: 2, c: 3, d: 4 });
        });
      });

      it("should handle spaced outer stream timing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('ab|', { a: 1, b: 2 });
          const inner2 = cold('cd|', { c: 3, d: 4 });
          
          const stream = cold('x---y|', { x: inner1, y: inner2 });
          const result = pipe(stream, concatAll());
          expectStream(result).toBe('ab--cd|', { a: 1, b: 2, c: 3, d: 4 });
        });
      });

      it("should handle grouped emissions in outer stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('ab|', { a: 1, b: 2 });
          const inner2 = cold('cd|', { c: 3, d: 4 });
          const inner3 = cold('e|', { e: 5 });
          
          const stream = cold('(xyz)|', { x: inner1, y: inner2, z: inner3 });
          const result = pipe(stream, concatAll());
          expectStream(result).toBe('abcde|', { a: 1, b: 2, c: 3, d: 4, e: 5 });
        });
      });

      it("should handle delayed inner streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('--a-b|', { a: 1, b: 2 });
          const inner2 = cold('-c-d|', { c: 3, d: 4 });
          
          const stream = cold('xy|', { x: inner1, y: inner2 });
          const result = pipe(stream, concatAll());
          expectStream(result).toBe('--a-b-c-d|', { a: 1, b: 2, c: 3, d: 4 });
        });
      });

      it("should handle rapid inner emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('(ab)|', { a: 1, b: 2 });
          const inner2 = cold('(cd)|', { c: 3, d: 4 });
          
          const stream = cold('x-y|', { x: inner1, y: inner2 });
          const result = pipe(stream, concatAll());
          expectStream(result).toBe('(ab)-(cd)|', { a: 1, b: 2, c: 3, d: 4 });
        });
      });

      it("should handle complex nested timing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('--a--(bc)|', { a: 1, b: 2, c: 3 });
          const inner2 = cold('d-(ef)-g|', { d: 4, e: 5, f: 6, g: 7 });
          
          const stream = cold('x--y|', { x: inner1, y: inner2 });
          const result = pipe(stream, concatAll());
          expectStream(result).toBe('--a--(bc)d-(ef)-g|', { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 });
        });
      });
    });

    describe("Error Handling", () => {
      it("should propagate outer stream errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner = cold('ab|', { a: 1, b: 2 });
          const stream = cold('x#', { x: inner });
          const result = pipe(stream, concatAll());
          expectStream(result).toBe('ab#', { a: 1, b: 2 });
        });
      });

      it("should propagate inner stream errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('ab|', { a: 1, b: 2 });
          const inner2 = cold('c#', { c: 3 });
          
          const stream = cold('xy|', { x: inner1, y: inner2 });
          const result = pipe(stream, concatAll());
          expectStream(result).toBe('abc#', { a: 1, b: 2, c: 3 });
        });
      });

      it("should not process subsequent inner streams after error", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('ab|', { a: 1, b: 2 });
          const inner2 = cold('c#', { c: 3 });
          const inner3 = cold('de|', { d: 4, e: 5 }); // Should not be processed
          
          const stream = cold('xyz|', { x: inner1, y: inner2, z: inner3 });
          const result = pipe(stream, concatAll());
          expectStream(result).toBe('abc#', { a: 1, b: 2, c: 3 });
        });
      });

      it("should handle error in first inner stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('a#', { a: 1 });
          const inner2 = cold('bc|', { b: 2, c: 3 });
          
          const stream = cold('xy|', { x: inner1, y: inner2 });
          const result = pipe(stream, concatAll());
          expectStream(result).toBe('a#', { a: 1 });
        });
      });

      it("should handle immediate error in outer stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('#');
          const result = pipe(stream, concatAll());
          expectStream(result).toBe('#');
        });
      });

      it("should handle error with timing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('a-b|', { a: 1, b: 2 });
          const inner2 = cold('-c-#', { c: 3 });
          
          const stream = cold('x-y|', { x: inner1, y: inner2 });
          const result = pipe(stream, concatAll());
          expectStream(result).toBe('a-b-c-#', { a: 1, b: 2, c: 3 });
        });
      });
    });

    describe("Sequential Processing", () => {
      it("should wait for each inner stream to complete", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('a---b|', { a: 1, b: 2 });
          const inner2 = cold('c-d|', { c: 3, d: 4 });
          
          const stream = cold('(xy)|', { x: inner1, y: inner2 });
          const result = pipe(stream, concatAll());
          expectStream(result).toBe('a---bc-d|', { a: 1, b: 2, c: 3, d: 4 });
        });
      });

      it("should maintain order regardless of inner stream timing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('a--------b|', { a: 1, b: 2 }); // Long stream
          const inner2 = cold('c|', { c: 3 }); // Short stream
          
          const stream = cold('xy|', { x: inner1, y: inner2 });
          const result = pipe(stream, concatAll());
          expectStream(result).toBe('a--------bc|', { a: 1, b: 2, c: 3 });
        });
      });

      it("should handle many sequential inner streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('a|', { a: 1 });
          const inner2 = cold('b|', { b: 2 });
          const inner3 = cold('c|', { c: 3 });
          const inner4 = cold('d|', { d: 4 });
          const inner5 = cold('e|', { e: 5 });
          
          const stream = cold('vwxyz|', { v: inner1, w: inner2, x: inner3, y: inner4, z: inner5 });
          const result = pipe(stream, concatAll());
          expectStream(result).toBe('abcde|', { a: 1, b: 2, c: 3, d: 4, e: 5 });
        });
      });
    });

    describe("Edge Cases", () => {
      it("should handle all empty inner streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('|');
          const inner2 = cold('|');
          const inner3 = cold('|');
          
          const stream = cold('xyz|', { x: inner1, y: inner2, z: inner3 });
          const result = pipe(stream, concatAll());
          expectStream(result).toBe('---|');
        });
      });

      it("should handle single inner stream with complex timing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner = cold('--a--(bc)---d|', { a: 1, b: 2, c: 3, d: 4 });
          const stream = cold('x|', { x: inner });
          const result = pipe(stream, concatAll());
          expectStream(result).toBe('--a--(bc)---d|', { a: 1, b: 2, c: 3, d: 4 });
        });
      });

      it("should handle outer stream completion before inner completion", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner = cold('a---b---c|', { a: 1, b: 2, c: 3 });
          const stream = cold('x|', { x: inner });
          const result = pipe(stream, concatAll());
          expectStream(result).toBe('a---b---c|', { a: 1, b: 2, c: 3 });
        });
      });

      it("should handle hot stream subscription pattern", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const inner1 = cold('ab|', { a: 1, b: 2 });
          const inner2 = cold('cd|', { c: 3, d: 4 });
          
          const stream = cold('xy^z|', { x: inner1, y: inner2, z: inner1 });
          const result = pipe(stream, concatAll());
          expectStream(result).toBe('ab|', { a: 1, b: 2 });
        });
      });
    });
  });
});
