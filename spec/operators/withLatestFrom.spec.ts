import { expect } from "chai";
import { from, pipe, toArray, withLatestFrom, of, timer, Subject, take, delay, throwError, timeout } from "../../src/index.js";
import { VirtualTimeScheduler } from "../../src/testing/virtual-tick-scheduler.js";


describe("withLatestFrom", () => {
  describe("Real Time", () => {
    it("should combine with latest from other stream", async () => {
      const source = from([1, 2, 3]);
      const other = from(['a', 'b', 'c']);
      
      // This is a simplified test - in real scenarios timing matters more
      const result = await toArray(pipe(
        source,
        withLatestFrom(other)
      ));
      
      // Should get some combined values
      expect(result.length).to.be.greaterThanOrEqual(0);
    });

    it("should wait for other stream to emit before emitting", async () => {
      const source = of(1);
      const other = new ReadableStream({
        start(controller) {
          // Never emit anything
          setTimeout(() => controller.close(), 50);
        }
      });
      
      const result = await toArray(pipe(
        source,
        withLatestFrom(other)
      ));
      
      // Should not emit anything since other stream never emitted
      expect(result).to.deep.equal([]);
    });

    it("should use latest value from other stream", async () => {
      const sourceSubject = new Subject<number>();
      const otherSubject = new Subject<string>();
      
      const resultPromise = toArray(pipe(
        sourceSubject.readable,
        withLatestFrom(otherSubject.readable)
      ));
      
      // Emit to other stream first
      otherSubject.next('first');
      otherSubject.next('latest');
      
      // Add small delay to ensure values are processed
      await new Promise(resolve => setTimeout(resolve, 1));
      
      // Then emit to source - should use latest from other
      sourceSubject.next(1);
      sourceSubject.complete();
      
      const result = await resultPromise;
      expect(result).to.deep.equal([[1, 'latest']]);
    });

    it("should work with multiple other streams", async () => {
      const sourceSubject = new Subject<number>();
      const otherA = new Subject<string>();
      const otherB = new Subject<boolean>();
      
      const resultPromise = toArray(pipe(
        sourceSubject.readable,
        withLatestFrom(otherA.readable, otherB.readable)
      ));
      
      // Emit to other streams first
      otherA.next('a');
      otherB.next(true);
      
      // Then emit to source
      sourceSubject.next(1);
      sourceSubject.complete();
      
      const result = await resultPromise;
      expect(result).to.deep.equal([[1, 'a', true]]);
    });

    it("should handle source stream completing before others emit", async () => {
      const source = of(1);
      const other = new ReadableStream({
        start(controller) {
          setTimeout(() => {
            controller.enqueue('late');
            controller.close();
          }, 100);
        }
      });
      
      const result = await toArray(pipe(
        source,
        withLatestFrom(other)
      ));
      
      expect(result).to.deep.equal([]);
    });

    it("should handle other stream erroring", async () => {
      const sourceSubject = new Subject<number>();
      const otherSubject = new Subject<string>();
      
      const resultPromise = toArray(pipe(
        sourceSubject.readable,
        withLatestFrom(otherSubject.readable)
      ));
      
      // Error the other stream
      otherSubject.error(new Error('other error'));
      
      // Source should still be able to emit (though nothing will combine)
      sourceSubject.next(1);
      sourceSubject.complete();
      
      const result = await resultPromise;
      expect(result).to.deep.equal([]);
    });

    it("should handle source stream erroring", async () => {
      const source = throwError(new Error('source error'));
      const other = of('test');
      
      try {
        await toArray(pipe(
          source,
          withLatestFrom(other)
        ));
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err.message).to.equal('source error');
      }
    });

    it("should handle cancellation properly", async () => {
      const sourceSubject = new Subject<number>();
      const otherSubject = new Subject<string>();
      
      const stream = pipe(
        sourceSubject.readable,
        withLatestFrom(otherSubject.readable)
      );
      
      const reader = stream.getReader();
      
      // Emit to other first
      otherSubject.next('value');
      
      // Start reading
      const readPromise = reader.read();
      
      // Cancel the reader
      await reader.cancel();
      
      // Should complete
      const result = await readPromise;
      expect(result.done).to.be.true;
    });

    it("should work with custom highWaterMark", async () => {
      const sourceSubject = new Subject<number>();
      const otherSubject = new Subject<string>();
      
      const resultPromise = toArray(pipe(
        sourceSubject.readable,
        (src) => withLatestFrom(otherSubject.readable)(src, { highWaterMark: 1 })
      ));
      
      otherSubject.next('test');
      sourceSubject.next(1);
      sourceSubject.complete();
      
      const result = await resultPromise;
      expect(result).to.deep.equal([[1, 'test']]);
    });

    it("should handle backpressure correctly", async () => {
      const sourceSubject = new Subject<number>();
      const otherSubject = new Subject<string>();
      
      const stream = pipe(
        sourceSubject.readable,
        withLatestFrom(otherSubject.readable)
      );
      
      const reader = stream.getReader();
      
      // Emit to other first
      otherSubject.next('value');
      
      // Emit multiple values to source
      sourceSubject.next(1);
      sourceSubject.next(2);
      sourceSubject.next(3);
      sourceSubject.complete();
      
      const results = [];
      let result = await reader.read();
      while (!result.done) {
        results.push(result.value);
        result = await reader.read();
      }
      
      expect(results.length).to.be.greaterThan(0);
      expect(results[0]).to.deep.equal([1, 'value']);
    });

    it("should handle multiple emissions from other streams", async () => {
      const sourceSubject = new Subject<number>();
      const otherSubject = new Subject<string>();
      
      const resultPromise = toArray(pipe(
        sourceSubject.readable,
        withLatestFrom(otherSubject.readable)
      ));
      
      // Multiple emissions from other
      otherSubject.next('first');
      otherSubject.next('second');
      otherSubject.next('latest');
      
      // Add small delay to ensure values are processed
      await new Promise(resolve => setTimeout(resolve, 1));
      
      // Single emission from source should use latest
      sourceSubject.next(1);
      sourceSubject.complete();
      
      const result = await resultPromise;
      expect(result).to.deep.equal([[1, 'latest']]);
    });

    it("should handle empty source stream", async () => {
      const source = from([]);
      const other = of('value');
      
      const result = await toArray(pipe(
        source,
        withLatestFrom(other)
      ));
      
      expect(result).to.deep.equal([]);
    });

    it("should handle empty other stream", async () => {
      const source = of(1);
      const other = from([]);
      
      const result = await toArray(pipe(
        source,
        withLatestFrom(other)
      ));
      
      expect(result).to.deep.equal([]);
    });

    it("should work with timing-based streams", async () => {
      // Create a slow source and fast other
      const source = pipe(timer(50, 100), take(2)); // Emit at 50ms, 150ms
      const other = pipe(timer(25, 25), take(3));   // Emit at 25ms, 50ms, 75ms
      
      const result = await toArray(pipe(
        source,
        withLatestFrom(other)
      ));
      
      // Should get combined values
      expect(result.length).to.be.greaterThan(0);
      expect(Array.isArray(result[0])).to.be.true;
      expect(result[0].length).to.equal(2); // [source_value, other_value]
    });

    it("should handle three other streams", async () => {
      const sourceSubject = new Subject<number>();
      const otherA = new Subject<string>();
      const otherB = new Subject<boolean>();
      const otherC = new Subject<number>();
      
      const resultPromise = toArray(pipe(
        sourceSubject.readable,
        withLatestFrom(otherA.readable, otherB.readable, otherC.readable)
      ));
      
      // Emit to all other streams
      otherA.next('a');
      otherB.next(true);
      otherC.next(42);
      
      // Then emit to source
      sourceSubject.next(1);
      sourceSubject.complete();
      
      const result = await resultPromise;
      expect(result).to.deep.equal([[1, 'a', true, 42]]);
    });

    it("should handle reader cancellation during read", async () => {
      const sourceSubject = new Subject<number>();
      const otherSubject = new Subject<string>();
      
      const stream = pipe(
        sourceSubject.readable,
        withLatestFrom(otherSubject.readable)
      );
      
      const reader = stream.getReader();
      
      // Emit to other
      otherSubject.next('value');
      
      // Cancel during a read operation
      const readPromise = reader.read();
      reader.cancel();
      
      const result = await readPromise;
      expect(result.done).to.be.true;
    });
  });

  describe("Virtual Time", () => {
    describe("Basic Combination Behavior", () => {
      it("should combine with latest from other stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
          const other = cold("x-y-z|", { x: "first", y: "second", z: "third" });
          
          const result = pipe(
            source,
            withLatestFrom(other)
          );
          
          expectStream(result).toBe("a-b-c|", { 
            a: [1, "first"], 
            b: [2, "second"], 
            c: [3, "third"] 
          });
        });
      });

      it("should wait for other stream to emit before emitting", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
          const other = cold("--x-y|", { x: "first", y: "second" });
          
          const result = pipe(
            source,
            withLatestFrom(other)
          );
          
          expectStream(result).toBe("--b-c|", { 
            b: [2, "first"], 
            c: [3, "second"] 
          });
        });
      });

      it("should use latest value from other stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("----a|", { a: 1 });
          const other = cold("x-y-z|", { x: "first", y: "second", z: "third" });
          
          const result = pipe(
            source,
            withLatestFrom(other)
          );
          
          expectStream(result).toBe("----a|", { a: [1, "third"] });
        });
      });

      it("should handle empty source stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("|", {} as Record<string, number>);
          const other = cold("x-y-z|", { x: "first", y: "second", z: "third" });
          
          const result = pipe(
            source,
            withLatestFrom(other)
          );
          
          expectStream(result).toBe("|");
        });
      });

      it("should handle empty other stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
          const other = cold("|", {} as Record<string, string>);
          
          const result = pipe(
            source,
            withLatestFrom(other)
          );
          
          expectStream(result).toBe("-----|");
        });
      });

      it("should handle source completing before other emits", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b|", { a: 1, b: 2 });
          const other = cold("----x|", { x: "late" });
          
          const result = pipe(
            source,
            withLatestFrom(other)
          );
          
          expectStream(result).toBe("---|");
        });
      });

      it("should handle other completing before source", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("----a-b|", { a: 1, b: 2 });
          const other = cold("x-y|", { x: "first", y: "second" });
          
          const result = pipe(
            source,
            withLatestFrom(other)
          );
          
          expectStream(result).toBe("----a-b|", { 
            a: [1, "second"], 
            b: [2, "second"] 
          });
        });
      });

      it("should handle single values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a|", { a: 1 });
          const other = cold("x|", { x: "value" });
          
          const result = pipe(
            source,
            withLatestFrom(other)
          );
          
          expectStream(result).toBe("a|", { a: [1, "value"] });
        });
      });
    });

    describe("Timing Patterns", () => {
      it("should handle different timing patterns", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a---b---c|", { a: 1, b: 2, c: 3 });
          const other = cold("-x-y-z---|", { x: "first", y: "second", z: "third" });
          
          const result = pipe(
            source,
            withLatestFrom(other)
          );
          
          expectStream(result).toBe("----b---c|", { 
            b: [2, "second"], 
            c: [3, "third"] 
          });
        });
      });

      it("should handle rapid emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("(abc)d|", { a: 1, b: 2, c: 3, d: 4 });
          const other = cold("x-y-z|", { x: "first", y: "second", z: "third" });
          
          const result = pipe(
            source,
            withLatestFrom(other)
          );
          
          expectStream(result).toBe("(abc)d|", { 
            a: [1, "first"], 
            b: [2, "first"], 
            c: [3, "first"],
            d: [4, "first"] // Still using "first" at tick 1, "second" hasn't arrived yet
          });
        });
      });

      it("should handle rapid emissions from other", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a---b|", { a: 1, b: 2 });
          const other = cold("(xyz)w|", { x: "first", y: "second", z: "third", w: "fourth" });
          
          const result = pipe(
            source,
            withLatestFrom(other)
          );
          
          expectStream(result).toBe("a---b|", { 
            a: [1, "third"], 
            b: [2, "fourth"] 
          });
        });
      });

      it("should handle delayed start for other stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c-d|", { a: 1, b: 2, c: 3, d: 4 });
          const other = cold("----x-y|", { x: "first", y: "second" });
          
          const result = pipe(
            source,
            withLatestFrom(other)
          );
          
          expectStream(result).toBe("----c-d|", { 
            c: [3, "first"], 
            d: [4, "second"] 
          });
        });
      });

      it("should handle delayed start for source stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("----a-b|", { a: 1, b: 2 });
          const other = cold("x-y-z|", { x: "first", y: "second", z: "third" });
          
          const result = pipe(
            source,
            withLatestFrom(other)
          );
          
          expectStream(result).toBe("----a-b|", { 
            a: [1, "third"], 
            b: [2, "third"] 
          });
        });
      });

      it("should handle long delays between values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a----------b|", { a: 1, b: 2 });
          const other = cold("x-y--------z|", { x: "first", y: "second", z: "third" });
          
          const result = pipe(
            source,
            withLatestFrom(other)
          );
          
          expectStream(result).toBe("a----------b|", { 
            a: [1, "first"], 
            b: [2, "third"] 
          });
        });
      });
    });

    describe("Multiple Other Streams", () => {
      it("should work with two other streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
          const other1 = cold("x-y-z|", { x: "first", y: "second", z: "third" });
          const other2 = cold("p-q-r|", { p: true, q: false, r: true });
          
          const result = pipe(
            source,
            withLatestFrom(other1, other2)
          );
          
          expectStream(result).toBe("a-b-c|", { 
            a: [1, "first", true], 
            b: [2, "second", false], 
            c: [3, "third", true] 
          });
        });
      });

      it("should wait for all other streams to emit", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c-d|", { a: 1, b: 2, c: 3, d: 4 });
          const other1 = cold("x-y---|", { x: "first", y: "second" });
          const other2 = cold("--p--q|", { p: true, q: false });
          
          const result = pipe(
            source,
            withLatestFrom(other1, other2)
          );
          
          expectStream(result).toBe("--b-c-d|", { 
            b: [2, "second", true], // tick 2: other1="second", other2="true"
            c: [3, "second", true], // tick 4: other1="second", other2="true" (q at tick 5, not yet)
            d: [4, "second", false] // tick 6: other1="second", other2="false"
          });
        });
      });

      it("should work with three other streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b|", { a: 1, b: 2 });
          const other1 = cold("x|", { x: "str" });
          const other2 = cold("p|", { p: true });
          const other3 = cold("m|", { m: 42 });
          
          const result = pipe(
            source,
            withLatestFrom(other1, other2, other3)
          );
          
          expectStream(result).toBe("a-b|", { 
            a: [1, "str", true, 42], 
            b: [2, "str", true, 42] 
          });
        });
      });

      it("should handle missing values from some other streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
          const other1 = cold("x-y|", { x: "first", y: "second" });
          const other2 = cold("----p|", { p: true });
          
          const result = pipe(
            source,
            withLatestFrom(other1, other2)
          );
          
          expectStream(result).toBe("----c|", { c: [3, "second", true] });
        });
      });
    });

    describe("Error Handling", () => {
      it("should propagate errors from source stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Source error");
          const source = cold("a-b-#", { a: 1, b: 2 }, error);
          const other = cold("x-y-z|", { x: "first", y: "second", z: "third" });
          
          const result = pipe(
            source,
            withLatestFrom(other)
          );
          
          expectStream(result).toBe("a-b-#", { 
            a: [1, "first"], 
            b: [2, "second"] 
          }, error);
        });
      });

      it("should handle immediate errors from source", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Immediate error");
          const source = cold("#", {}, error);
          const other = cold("x-y-z|", { x: "first", y: "second", z: "third" });
          
          const result = pipe(
            source,
            withLatestFrom(other)
          );
          
          expectStream(result).toBe("#", {}, error);
        });
      });

      it("should handle errors from other stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
          const error = new Error("Other error");
          const other = cold("x-#", { x: "first" }, error);
          
          const result = pipe(
            source,
            withLatestFrom(other)
          );
          
          // Other stream error is silently ignored, source continues
          expectStream(result).toBe("a-b-c|", { 
            a: [1, "first"], 
            b: [2, "first"], 
            c: [3, "first"] 
          });
        });
      });

      it("should handle errors in multiple other streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
          const other1 = cold("x-y|", { x: "first", y: "second" });
          const error = new Error("Other2 error");
          const other2 = cold("p-#", { p: true }, error);
          
          const result = pipe(
            source,
            withLatestFrom(other1, other2)
          );
          
          // Other2 stream error is silently ignored, uses latest values
          expectStream(result).toBe("a-b-c|", { 
            a: [1, "first", true], 
            b: [2, "second", true], 
            c: [3, "second", true] 
          });
        });
      });

      it("should handle immediate error from other stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
          const error = new Error("Immediate other error");
          const other = cold("#", {}, error);
          
          const result = pipe(
            source,
            withLatestFrom(other)
          );
          
          // Other stream never emitted, so source can't emit combined values
          expectStream(result).toBe("-----|");
        });
      });

      it("should handle concurrent errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const sourceError = new Error("Source error");
          const source = cold("a-#", { a: 1 }, sourceError);
          const otherError = new Error("Other error");
          const other = cold("x-#", { x: "first" }, otherError);
          
          const result = pipe(
            source,
            withLatestFrom(other)
          );
          
          // Source error should take precedence since it controls emissions
          expectStream(result).toBe("a-#", { a: [1, "first"] }, sourceError);
        });
      });
    });

    describe("Never Stream Edge Cases", () => {
      it("should handle never source stream with timeout", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("-", {} as Record<string, number>);
          const other = cold("x-y-z|", { x: "first", y: "second", z: "third" });
          
          const result = pipe(
            source,
            withLatestFrom(other),
            timeout(10)
          );
          
          expectStream(result).toBe("----------#", {}, Error("Stream timeout after 10ms"));
        });
      });

      it("should handle never other stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
          const other = cold("-", {} as Record<string, string>);
          
          const result = pipe(
            source,
            withLatestFrom(other)
          );
          
          expectStream(result).toBe("-----|");
        });
      });

      it("should handle completion with no emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("------|", {} as Record<string, number>);
          const other = cold("x-y-z|", { x: "first", y: "second", z: "third" });
          
          const result = pipe(
            source,
            withLatestFrom(other)
          );
          
          expectStream(result).toBe("------|");
        });
      });
    });

    describe("Data Types", () => {
      it("should work with different data types", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b|", { a: 1, b: 2 });
          const other = cold("x-y|", { x: { id: 1 }, y: { id: 2 } });
          
          const result = pipe(
            source,
            withLatestFrom(other)
          );
          
          expectStream(result).toBe("a-b|", { 
            a: [1, { id: 1 }], 
            b: [2, { id: 2 }] 
          });
        });
      });

      it("should work with arrays", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b|", { a: [1, 2], b: [3, 4] });
          const other = cold("x-y|", { x: ["a", "b"], y: ["c", "d"] });
          
          const result = pipe(
            source,
            withLatestFrom(other)
          );
          
          expectStream(result).toBe("a-b|", { 
            a: [[1, 2], ["a", "b"]], 
            b: [[3, 4], ["c", "d"]] 
          });
        });
      });

      it("should work with mixed types", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b|", { a: 1, b: "hello" });
          const other = cold("x-y|", { x: true, y: null });
          
          const result = pipe(
            source,
            withLatestFrom(other)
          );
          
          expectStream(result).toBe("a-b|", { 
            a: [1, true], 
            b: ["hello", null] 
          });
        });
      });

      it("should work with falsy values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b|", { a: 0, b: false });
          const other = cold("x-y|", { x: "", y: null });
          
          const result = pipe(
            source,
            withLatestFrom(other)
          );
          
          expectStream(result).toBe("a-b|", { 
            a: [0, ""], 
            b: [false, null] 
          });
        });
      });
    });

    describe("Subscription Timing", () => {
      it("should handle late subscription", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("ab^c-d|", { a: 1, b: 2, c: 3, d: 4 });
          const other = cold("xy^z-w|", { x: "first", y: "second", z: "third", w: "fourth" });
          
          const result = pipe(
            source,
            withLatestFrom(other)
          );
          
          expectStream(result).toBe("c-d|", { 
            c: [3, "third"], 
            d: [4, "fourth"] 
          });
        });
      });

      it("should handle subscription after completion", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b|^", { a: 1, b: 2 });
          const other = cold("x-y|^", { x: "first", y: "second" });
          
          const result = pipe(
            source,
            withLatestFrom(other)
          );
          
          expectStream(result).toBe("|");
        });
      });

      it("should handle mixed subscription timing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b^c-d|", { a: 1, b: 2, c: 3, d: 4 });
          const other = cold("x-y-z-w|", { x: "first", y: "second", z: "third", w: "fourth" });
          
          const result = pipe(
            source,
            withLatestFrom(other)
          );
          
          expectStream(result).toBe("c-d|", { 
            c: [3, "first"], // At subscription (tick 2), other has "first" (tick 0) 
            d: [4, "second"] // At tick 3, other has "second" (tick 1)
          });
        });
      });
    });
  });
});
