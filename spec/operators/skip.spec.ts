import { expect } from "chai";
import { toArray, from, pipe, skip, timeout } from '../../src/index.js';
import { Subject } from '../../src/subjects/subject.js';
import { VirtualTimeScheduler } from "../../src/testing/virtual-tick-scheduler.js";


describe("skip", () => {
  describe("Real Time", () => {
    it("can skip less than total ", async () => {
      let inputA = [1, 2, 3, 4, 5];
      let expected = [4, 5]

      let result = await toArray(
        pipe(
          from(inputA),
          skip(3))
      );

      expect(result, "stream result matches expected").to.be.deep.eq(expected);
    })

    it("can skip more than total ", async () => {
      let inputA = [1, 2, 3, 4, 5];
      let expected = []

      let result = await toArray(
        pipe(
          from(inputA),
          skip(10))
      );

      expect(result, "stream result matches expected").to.be.deep.eq(expected);
    })
    
    it("can skip none", async () => {
      let inputA = [1, 2, 3, 4, 5];
      let expected = [1, 2, 3, 4, 5]

      let result = await toArray(
        pipe(
          from(inputA),
          skip(0))
      );

      expect(result, "stream result matches expected").to.be.deep.eq(expected);
    })

    it("should handle negative skip count", async () => {
      let inputA = [1, 2, 3, 4, 5];
      let expected = [1, 2, 3, 4, 5]; // Negative skip should behave like skip(0)

      let result = await toArray(
        pipe(
          from(inputA),
          skip(-5))
      );

      expect(result, "stream result matches expected").to.be.deep.eq(expected);
    })

    it("should handle empty stream", async () => {
      let result = await toArray(
        pipe(
          from([]),
          skip(3))
      );

      expect(result).to.be.deep.eq([]);
    })

    it("should handle single element with skip", async () => {
      let result = await toArray(
        pipe(
          from([42]),
          skip(1))
      );

      expect(result).to.be.deep.eq([]);
    })

    it("should handle single element without skip", async () => {
      let result = await toArray(
        pipe(
          from([42]),
          skip(0))
      );

      expect(result).to.be.deep.eq([42]);
    })

    it("should handle stream errors", async () => {
      const errorMessage = "Source error";
      const errorStream = new ReadableStream({
        start(controller) {
          controller.enqueue(1);
          controller.enqueue(2);
          controller.error(new Error(errorMessage));
        }
      });

      try {
        await toArray(pipe(
          errorStream,
          skip(1)
        ));
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err.message).to.equal(errorMessage);
      }
    })

    it("should handle cancellation properly", async () => {
      const subject = new Subject<number>();
      
      const stream = pipe(
        subject.readable,
        skip(2)
      );
      
      const reader = stream.getReader();
      
      // Emit values, but they'll be skipped
      await subject.next(1);
      await subject.next(2);
      await subject.next(3); // This should come through
      
      const first = await reader.read();
      expect(first.value).to.equal(3);
      
      // Cancel the reader
      await reader.cancel("Test cancellation");
      reader.releaseLock();
      
      // Further values should not be processed
      await subject.next(4);
      await subject.complete();
    })

    it("should work with custom highWaterMark", async () => {
      let inputA = [1, 2, 3, 4, 5];
      let expected = [3, 4, 5]

      let result = await toArray(
        skip(2)(
          from(inputA),
          { highWaterMark: 1 }
        )
      );

      expect(result).to.be.deep.eq(expected);
    })

    it("should handle backpressure correctly", async () => {
      const subject = new Subject<number>();
      
      const stream = pipe(
        subject.readable,
        skip(2)
      );
      
      const reader = stream.getReader();
      const results: number[] = [];
      
      // Emit values
      await subject.next(1); // skipped
      await subject.next(2); // skipped
      await subject.next(3); // passed through
      await subject.next(4); // passed through
      await subject.complete();
      
      // Read all values
      try {
        while (true) {
          const result = await reader.read();
          if (result.done) break;
          results.push(result.value);
        }
      } finally {
        try {
          await reader.cancel();
        } catch (e) {
          // Ignore cancel errors
        }
        reader.releaseLock();
      }
      
      expect(results).to.deep.equal([3, 4]);
    })

    it("should handle reader cleanup errors during cancel", async () => {
      const subject = new Subject<number>();
      
      const stream = pipe(
        subject.readable,
        skip(1)
      );
      
      const reader = stream.getReader();
      
      await subject.next(1); // skipped
      await subject.next(2); // passed through
      
      const first = await reader.read();
      expect(first.value).to.equal(2);
      
      // Cancel should handle cleanup gracefully
      await reader.cancel("test");
      reader.releaseLock();
    })

    it("should work with different data types", async () => {
      const strings = ["a", "b", "c", "d", "e"];
      const expected = ["c", "d", "e"];

      const result = await toArray(
        pipe(
          from(strings),
          skip(2)
        )
      );

      expect(result).to.deep.equal(expected);
    })

    it("should skip exactly the specified count", async () => {
      const subject = new Subject<number>();
      
      const resultPromise = toArray(
        pipe(
          subject.readable,
          skip(3)
        )
      );
      
      // Emit more values than skip count
      for (let i = 1; i <= 10; i++) {
        await subject.next(i);
      }
      await subject.complete();
      
      const result = await resultPromise;
      
      // Should skip first 3, then emit the rest
      expect(result).to.deep.equal([4, 5, 6, 7, 8, 9, 10]);
    })

    it("should handle very large skip count", async () => {
      const inputA = [1, 2, 3, 4, 5];
      const expected = [];

      const result = await toArray(
        pipe(
          from(inputA),
          skip(Number.MAX_SAFE_INTEGER)
        )
      );

      expect(result).to.deep.equal(expected);
    })

    it("should handle skip with async stream source", async () => {
      const subject = new Subject<number>();
      
      const stream = pipe(
        subject.readable,
        skip(2)
      );
      
      const reader = stream.getReader();
      
      // Emit values asynchronously
      setTimeout(() => subject.next(1), 10); // skipped
      setTimeout(() => subject.next(2), 20); // skipped  
      setTimeout(() => subject.next(3), 30); // passed through
      setTimeout(() => subject.complete(), 40);
      
      const first = await reader.read();
      expect(first.value).to.equal(3);
      
      const second = await reader.read();
      expect(second.done).to.be.true;
      
      await reader.cancel();
      reader.releaseLock();
    })

    it("should handle stream completion during skip phase", async () => {
      const result = await toArray(
        pipe(
          from([1, 2]), // Only 2 elements
          skip(5) // Skip more than available
        )
      );

      expect(result).to.deep.equal([]); // Should be empty
    })

    it("should maintain correct skip count across multiple reads", async () => {
      const subject = new Subject<number>();
      
      const stream = pipe(
        subject.readable,
        skip(3)
      );
      
      const reader = stream.getReader();
      
      // Emit one at a time and verify skipping behavior
      await subject.next(1); // skip count: 3 -> 2
      await subject.next(2); // skip count: 2 -> 1  
      await subject.next(3); // skip count: 1 -> 0
      await subject.next(4); // skip count: 0, emit this
      
      const first = await reader.read();
      expect(first.value).to.equal(4);
      
      // Further values should pass through
      await subject.next(5);
      const second = await reader.read();
      expect(second.value).to.equal(5);
      
      await subject.complete();
      const final = await reader.read();
      expect(final.done).to.be.true;
      
      await reader.cancel();
      reader.releaseLock();
    })
  });

  describe("Virtual Time", () => {
    describe("Basic Skip Behavior", () => {
      it("should skip first few values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c-d-e|", { a: 1, b: 2, c: 3, d: 4, e: 5 });
          
          const result = pipe(
            source,
            skip(2)
          );
          
          expectStream(result).toBe("----c-d-e|", { c: 3, d: 4, e: 5 });
        });
      });

      it("should skip more than available", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            skip(5)
          );
          
          expectStream(result).toBe("-----|");
        });
      });

      it("should skip zero values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            skip(0)
          );
          
          expectStream(result).toBe("a-b-c|", { a: 1, b: 2, c: 3 });
        });
      });

      it("should skip negative values (behaves like skip 0)", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            skip(-3)
          );
          
          expectStream(result).toBe("a-b-c|", { a: 1, b: 2, c: 3 });
        });
      });

      it("should skip all values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            skip(3)
          );
          
          expectStream(result).toBe("-----|");
        });
      });

      it("should handle single value with skip", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a|", { a: 42 });
          
          const result = pipe(
            source,
            skip(1)
          );
          
          expectStream(result).toBe("-|");
        });
      });

      it("should handle single value without skip", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a|", { a: 42 });
          
          const result = pipe(
            source,
            skip(0)
          );
          
          expectStream(result).toBe("a|", { a: 42 });
        });
      });
    });

    describe("Timing Patterns", () => {
      it("should maintain source timing for passed values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a---b--c----d|", { a: 1, b: 2, c: 3, d: 4 });
          
          const result = pipe(
            source,
            skip(2)
          );
          
          expectStream(result).toBe("-------c----d|", { c: 3, d: 4 });
        });
      });

      it("should handle grouped emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("(abc)-d-e|", { a: 1, b: 2, c: 3, d: 4, e: 5 });
          
          const result = pipe(
            source,
            skip(2)
          );
          
          expectStream(result).toBe("c-d-e|", { c: 3, d: 4, e: 5 });
        });
      });

      it("should handle immediate emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("(abcde)|", { a: 1, b: 2, c: 3, d: 4, e: 5 });
          
          const result = pipe(
            source,
            skip(3)
          );
          
          expectStream(result).toBe("(de)|", { d: 4, e: 5 });
        });
      });

      it("should handle delayed start", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("-----a-b-c|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            skip(1)
          );
          
          expectStream(result).toBe("-------b-c|", { b: 2, c: 3 });
        });
      });

      it("should handle spaced emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a--b--c--d--e|", { a: 1, b: 2, c: 3, d: 4, e: 5 });
          
          const result = pipe(
            source,
            skip(2)
          );
          
          expectStream(result).toBe("------c--d--e|", { c: 3, d: 4, e: 5 });
        });
      });

      it("should handle long delays", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a----------b----------c|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            skip(1)
          );
          
          expectStream(result).toBe("-----------b----------c|", { b: 2, c: 3 });
        });
      });
    });

    describe("Empty and Edge Cases", () => {
      it("should handle empty stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("|", {} as Record<string, number>, undefined);
          
          const result = pipe(
            source,
            skip(3)
          );
          
          expectStream(result).toBe("|");
        });
      });

      it("should handle never-like stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          //never close input
          const source = cold("-", {} as Record<string, number>, undefined);
          
          const result = pipe(
            source,
            skip(2), 
            timeout(10) // we need a timeout for never-close streams
          );
          
          expectStream(result).toBe("----------#", undefined, Error("Stream timeout after 10ms"))
        });
      });

      it("should handle large skip count", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            skip(1000)
          );
          
          expectStream(result).toBe("-----|");
        });
      });

      it("should handle completion during skip phase", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b|", { a: 1, b: 2 });
          
          const result = pipe(
            source,
            skip(5)
          );
          
          expectStream(result).toBe("---|");
        });
      });

      it("should handle delayed completion", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a--------|", { a: 1 });
          
          const result = pipe(
            source,
            skip(1)
          );
          
          expectStream(result).toBe("---------|");
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
            skip(1)
          );
          
          expectStream(result).toBe("--b-#", { b: 2 }, error);
        });
      });

      it("should propagate immediate errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Immediate error");
          const source = cold("#", {}, error);
          
          const result = pipe(
            source,
            skip(3)
          );
          
          expectStream(result).toBe("#", {}, error);
        });
      });

      it("should propagate errors during skip phase", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Error during skip");
          const source = cold("a-#", { a: 1 }, error);
          
          const result = pipe(
            source,
            skip(5)
          );
          
          expectStream(result).toBe("--#", {}, error);
        });
      });

      it("should propagate errors after skip phase", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Error after skip");
          const source = cold("a-b-c-#", { a: 1, b: 2, c: 3 }, error);
          
          const result = pipe(
            source,
            skip(2)
          );
          
          expectStream(result).toBe("----c-#", { c: 3 }, error);
        });
      });

      it("should handle errors with grouped emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Grouped error");
          const source = cold("(ab)#", { a: 1, b: 2 }, error);
          
          const result = pipe(
            source,
            skip(1)
          );
          
          expectStream(result).toBe("(b)#", { b: 2 }, error);
        });
      });
    });

    describe("Data Types", () => {
      it("should work with strings", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c-d|", { a: "hello", b: "world", c: "foo", d: "bar" });
          
          const result = pipe(
            source,
            skip(2)
          );
          
          expectStream(result).toBe("----c-d|", { c: "foo", d: "bar" });
        });
      });

      it("should work with objects", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { 
            a: { id: 1 }, 
            b: { id: 2 }, 
            c: { id: 3 } 
          });
          
          const result = pipe(
            source,
            skip(1)
          );
          
          expectStream(result).toBe("--b-c|", { 
            b: { id: 2 }, 
            c: { id: 3 } 
          });
        });
      });

      it("should work with mixed types", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c-d|", { a: 1, b: "hello", c: true, d: null });
          
          const result = pipe(
            source,
            skip(2)
          );
          
          expectStream(result).toBe("----c-d|", { c: true, d: null });
        });
      });

      it("should work with arrays", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { 
            a: [1, 2], 
            b: [3, 4], 
            c: [5, 6] 
          });
          
          const result = pipe(
            source,
            skip(1)
          );
          
          expectStream(result).toBe("--b-c|", { 
            b: [3, 4], 
            c: [5, 6] 
          });
        });
      });

      it("should work with boolean values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c-d|", { a: true, b: false, c: true, d: false });
          
          const result = pipe(
            source,
            skip(2)
          );
          
          expectStream(result).toBe("----c-d|", { c: true, d: false });
        });
      });

      it("should work with zero and falsy values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c-d|", { a: 0, b: "", c: false, d: null });
          
          const result = pipe(
            source,
            skip(1)
          );
          
          expectStream(result).toBe("--b-c-d|", { b: "", c: false, d: null });
        });
      });
    });

    describe("Subscription Timing", () => {
      it("should handle late subscription", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("ab^c-d-e|", { a: 1, b: 2, c: 3, d: 4, e: 5 });
          
          const result = pipe(
            source,
            skip(1)
          );
          
          expectStream(result).toBe("--d-e|", { d: 4, e: 5 });
        });
      });

      it("should handle subscription after some values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b^c-d-e-f|", { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
          
          const result = pipe(
            source,
            skip(2)
          );
          
          expectStream(result).toBe("----e-f|", { e: 5, f: 6 });
        });
      });

      it("should handle subscription during completion", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b|^", { a: 1, b: 2 });
          
          const result = pipe(
            source,
            skip(1)
          );
          
          expectStream(result).toBe("|");
        });
      });
    });
  });
});
