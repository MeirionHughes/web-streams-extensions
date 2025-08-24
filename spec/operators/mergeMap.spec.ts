import { expect } from "chai";
import { toArray, from, pipe, mergeMap} from '../../src/index.js';
import { Subject } from '../../src/subjects/subject.js';
import { parseMarbles } from '../../src/testing/parse-marbles.js';
import { VirtualTimeScheduler } from '../../src/testing/virtual-tick-scheduler.js';


describe("mergeMap operator", () => {

  describe("Real Time", () => {

  it("should map each value to a stream and flatten", async () => {
    const result = await toArray(
      pipe(
        from([1, 2, 3]),
        mergeMap(n => from([n, n * 2]))
      )
    );

    // Should contain: 1, 2, 2, 4, 3, 6 (order may vary due to concurrency)
    expect(result).to.have.length(6);
    expect(result).to.include.members([1, 2, 2, 4, 3, 6]);
  });

  it("should work with promises", async () => {
    const result = await toArray(
      pipe(
        from([1, 2, 3]),
        mergeMap(n => Promise.resolve(n * 10))
      )
    );

    expect(result).to.have.length(3);
    expect(result).to.include.members([10, 20, 30]);
  });

  it("should work with arrays", async () => {
    const result = await toArray(
      pipe(
        from([1, 2]),
        mergeMap(n => Array(n).fill(n))
      )
    );

    expect(result).to.deep.equal([1, 2, 2]);
  });

  it("should pass index to projector function", async () => {
    const indices: number[] = [];
    
    await toArray(
      pipe(
        from(['a', 'b', 'c']),
        mergeMap((value, index) => {
          indices.push(index);
          return from([value]);
        })
      )
    );

    expect(indices).to.deep.equal([0, 1, 2]);
  });

  it("should handle empty source stream", async () => {
    const result = await toArray(
      pipe(
        from([]),
        mergeMap(n => from([n]))
      )
    );

    expect(result).to.deep.equal([]);
  });

  it("should handle empty inner streams", async () => {
    const result = await toArray(
      pipe(
        from([1, 2, 3]),
        mergeMap(() => from([]))
      )
    );

    expect(result).to.deep.equal([]);
  });

  it("should respect concurrency limit", async () => {
    const processOrder: number[] = [];
    const completeOrder: number[] = [];
    
    const result = await toArray(
      pipe(
        from([1, 2, 3, 4]),
        mergeMap(async (n) => {
          processOrder.push(n);
          // Simulate async work with different delays
          await new Promise(resolve => setTimeout(resolve, (5 - n) * 10));
          completeOrder.push(n);
          return from([n]);
        }, 2) // Limit to 2 concurrent operations
      )
    );

    expect(result).to.have.length(4);
    expect(result).to.include.members([1, 2, 3, 4]);
    
    // First two should start immediately
    expect(processOrder.slice(0, 2)).to.deep.equal([1, 2]);
    
    // Due to different delays and concurrency limit, completion order will be specific
    // Item 1 has longest delay (40ms), item 2 has 30ms delay
    // Item 3 and 4 start after 1 or 2 complete
  });

  it("should throw error for zero concurrency", () => {
    expect(() => {
      pipe(
        from([1, 2, 3]),
        mergeMap(n => from([n]), 0)
      );
    }).to.throw("Concurrency limit must be greater than zero");
  });

  it("should throw error for negative concurrency", () => {
    expect(() => {
      pipe(
        from([1, 2, 3]),
        mergeMap(n => from([n]), -1)
      );
    }).to.throw("Concurrency limit must be greater than zero");
  });

  it("should handle errors in projector function", async () => {
    try {
      await toArray(
        pipe(
          from([1, 2, 3]),
          mergeMap(n => {
            if (n === 2) throw new Error("Projector error");
            return from([n]);
          })
        )
      );
      expect.fail("Should have thrown error");
    } catch (err) {
      expect(err.message).to.include("Projector error");
    }
  });

  it("should handle errors in inner streams", async () => {
    try {
      await toArray(
        pipe(
          from([1, 2, 3]),
          mergeMap(n => {
            if (n === 2) {
              return new ReadableStream({
                start(controller) {
                  controller.error(new Error("Inner stream error"));
                }
              });
            }
            return from([n]);
          })
        )
      );
      expect.fail("Should have thrown error");
    } catch (err) {
      expect(err.message).to.include("Inner stream error");
    }
  });

  it("should handle async projector with different types", async () => {
    const result = await toArray(
      pipe(
        from([1, 2, 3]),
        mergeMap(async (n) => {
          // Return different types based on input
          if (n === 1) return from(['a', 'b']);
          if (n === 2) return Promise.resolve('c');
          return ['d', 'e'];
        })
      )
    );

    expect(result).to.have.length(5);
    expect(result).to.include.members(['a', 'b', 'c', 'd', 'e']);
  });

  it("should work with unlimited concurrency by default", async () => {
    const startTimes: number[] = [];
    
    await toArray(
      pipe(
        from([1, 2, 3, 4, 5]),
        mergeMap(async (n) => {
          startTimes.push(Date.now());
          await new Promise(resolve => setTimeout(resolve, 10));
          return from([n]);
        })
        // No concurrency limit specified, should default to Infinity
      )
    );

    // All should start at roughly the same time with unlimited concurrency
    const firstStart = startTimes[0];
    const allWithinTolerance = startTimes.every(time => Math.abs(time - firstStart) < 100);
    expect(allWithinTolerance).to.be.true;
  });

  it("should handle cancellation properly", async () => {
    const subject = new Subject<number>();
    
    const stream = pipe(
      subject.readable,
      mergeMap(n => from([n, n * 2]))
    );
    
    const reader = stream.getReader();
    
    await subject.next(1);
    const first = await reader.read();
    expect(first.value).to.be.oneOf([1, 2]);
    
    // Cancel should handle cleanup gracefully
    await reader.cancel("test");
    reader.releaseLock();
  });

  it("should maintain order with concurrency limit of 1", async () => {
    const result = await toArray(
      pipe(
        from([3, 1, 2]),
        mergeMap(async (n) => {
          // Different delays to test ordering
          await new Promise(resolve => setTimeout(resolve, (4 - n) * 10));
          return from([n]);
        }, 1) // Process one at a time
      )
    );

    // With concurrency 1, should maintain source order regardless of processing time
    expect(result).to.deep.equal([3, 1, 2]);
  });

  it("should work with complex nested streams", async () => {
    const result = await toArray(
      pipe(
        from([1, 2]),
        mergeMap(n => 
          pipe(
            from([n, n + 10]),
            mergeMap(x => from([x, x * 100]))
          )
        )
      )
    );

    // Should contain transformed values from nested mergeMap operations
    expect(result).to.have.length(8);
    expect(result).to.include.members([1, 100, 11, 1100, 2, 200, 12, 1200]);
  });

  }); // Real Time

  describe("Virtual Time", () => {
    it("should map each value to inner streams and merge concurrently", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(async ({ cold, expectStream }) => {
        const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
        
        const result = pipe(
          source,
          mergeMap((n: number) => cold("(x|)", { x: n * 10 }))
        );
        
        expectStream(result).toBe("a-b-c|", { a: 10, b: 20, c: 30 });
      });
    });

    it("should handle inner streams with different timings", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(async ({ cold, expectStream }) => {
        const source = cold("a-b|", { a: 1, b: 2 });
        
        const result = pipe(
          source,
          mergeMap((n: number) => {
            if (n === 1) return cold("--x|", { x: 'A' });
            return cold("-y|", { y: 'B' });
          })
        );
        
        expectStream(result).toBe("--AB|");
      });
    });

    it("should respect concurrency limit", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(async ({ cold, expectStream }) => {
        const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
        
        const result = pipe(
          source,
          mergeMap((n: number) => cold("--x|", { x: n }), 2)
        );
        
        // Only 2 concurrent, third waits for first to complete
        expectStream(result).toBe("--a-b-c|", { a: 1, b: 2, c: 3 });
      });
    });

    it("should handle empty inner streams", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(async ({ cold, expectStream }) => {
        const source = cold("a-b-c|");
        
        const result = pipe(
          source,
          mergeMap(() => cold("|"))
        );
        
        expectStream(result).toBe("-----|");
      });
    });

    it("should propagate inner stream errors", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(async ({ cold, expectStream }) => {
        const error = new Error("Inner error");
        const source = cold("a-b|", { a: 1, b: 2 });
        
        const result = pipe(
          source,
          mergeMap((n: number) => {
            if (n === 2) return cold("-#", {}, error);
            return cold("-x|", { x: n });
          })
        );
        
        expectStream(result).toBe("-a-#", { a: 1 }, error);
      });
    });

    it("should handle projector function errors", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(async ({ cold, expectStream }) => {
        const error = new Error("Projector error");
        const source = cold("a-b|", { a: 1, b: 2 });
        
        const result = pipe(
          source,
          mergeMap((n: number) => {
            if (n === 2) throw error;
            return cold("-x|", { x: n });
          })
        );
        
        expectStream(result).toBe("-a#", { a: 1 }, error);
      });
    });

    it("should handle multiple values from inner streams", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(async ({ cold, expectStream }) => {
        const source = cold("a-b|", { a: 1, b: 2 });
        
        const result = pipe(
          source,
          mergeMap((n: number) => cold("x-y|", { x: n, y: n + 10 }))
        );
        
        expectStream(result).toBe("a-(bc)-d|", { a: 1, b: 11, c: 2, d: 12 });
      });
    });

    it("should handle immediate completion of inner streams", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(async ({ cold, expectStream }) => {
        const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
        
        const result = pipe(
          source,
          mergeMap((n: number) => cold("(x|)", { x: n }))
        );
        
        expectStream(result).toBe("a-b-c|", { a: 1, b: 2, c: 3 });
      });
    });

    it("should handle overlapping inner streams with different completion times", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(async ({ cold, expectStream }) => {
        const source = cold("a-b|", { a: 1, b: 2 });
        
        const result = pipe(
          source,
          mergeMap((n: number) => {
            if (n === 1) return cold("--x-y|", { x: 'A', y: 'B' });
            return cold("-z|", { z: 'C' });
          })
        );
        
        expectStream(result).toBe("--ACB|");
      });
    });

    it("should complete when source and all inner streams complete", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(async ({ cold, expectStream }) => {
        const source = cold("a-b|", { a: 1, b: 2 });
        
        const result = pipe(
          source,
          mergeMap((n: number) => cold("--x|", { x: n }))
        );
        
        expectStream(result).toBe("--a-b|", { a: 1, b: 2 });
      });
    });

    it("should handle index parameter in projector", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(async ({ cold, expectStream }) => {
        const source = cold("a-b-c|", { a: 'x', b: 'y', c: 'z' });
        
        const result = pipe(
          source,
          mergeMap((value: string, index: number) => cold("(x|)", { x: `${value}${index}` }))
        );
        
        expectStream(result).toBe("a-b-c|", { a: 'x0', b: 'y1', c: 'z2' });
      });
    });
  });

});
