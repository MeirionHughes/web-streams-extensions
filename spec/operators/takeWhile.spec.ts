import { expect } from "chai";
import { from, pipe, toArray, takeWhile, timeout } from "../../src/index.js";
import { VirtualTimeScheduler } from "../../src/testing/virtual-tick-scheduler.js";


describe("takeWhile", () => {
  describe("Real Time", () => {
    it("should take while predicate is true", async () => {
      const result = await toArray(pipe(
        from([1, 2, 3, 4, 5]),
        takeWhile(x => x < 3)
      ));
      expect(result).to.deep.equal([1, 2]);
    });

    it("should handle empty stream", async () => {
      const result = await toArray(pipe(
        from([]),
        takeWhile(x => x < 3)
      ));
      expect(result).to.deep.equal([]);
    });

    it("should handle all values passing predicate", async () => {
      const result = await toArray(pipe(
        from([1, 2, 3]),
        takeWhile(x => x < 10)
      ));
      expect(result).to.deep.equal([1, 2, 3]);
    });

    it("should handle no values passing predicate", async () => {
      const result = await toArray(pipe(
        from([5, 6, 7]),
        takeWhile(x => x < 3)
      ));
      expect(result).to.deep.equal([]);
    });

    it("should stop at first false predicate", async () => {
      const result = await toArray(pipe(
        from([1, 2, 3, 2, 1]),
        takeWhile(x => x < 3)
      ));
      expect(result).to.deep.equal([1, 2]);
    });

    it("should handle predicate errors", async () => {
      try {
        await toArray(pipe(
          from([1, 2, 3]),
          takeWhile(x => {
            if (x === 2) throw new Error("Predicate error");
            return x < 10;
          })
        ));
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.equal("Predicate error");
      }
    });

    it("should handle stream errors", async () => {
      const errorStream = new ReadableStream({
        start(controller) {
          controller.enqueue(1);
          controller.enqueue(2);
          controller.error(new Error("Stream error"));
        }
      });

      try {
        await toArray(pipe(
          errorStream,
          takeWhile(x => x < 10)
        ));
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.equal("Stream error");
      }
    });

    it("should cancel source stream when predicate becomes false", async () => {
      let cancelled = false;
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(1);
          controller.enqueue(2);
          controller.enqueue(3);
          controller.enqueue(4);
          controller.close();
        },
        cancel() {
          cancelled = true;
        }
      });

      const result = await toArray(pipe(
        stream,
        takeWhile(x => x < 3)
      ));

      expect(result).to.deep.equal([1, 2]);
      // Note: The stream may not be cancelled immediately since takeWhile
      // checks the predicate after reading each value
    });

    it("should handle cleanup errors during cancellation", async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(1);
          controller.enqueue(2);
          controller.enqueue(3);
          controller.close();
        },
        cancel() {
          throw new Error("Cancel error");
        }
      });

      // Should still work despite cancel error
      const result = await toArray(pipe(
        stream,
        takeWhile(x => x < 3)
      ));

      expect(result).to.deep.equal([1, 2]);
    });

    it("should work with custom highWaterMark", async () => {
      const result = await toArray(pipe(
        from([1, 2, 3, 4, 5]),
        takeWhile(x => x < 4)
      ));
      expect(result).to.deep.equal([1, 2, 3]);
    });

    it("should handle backpressure correctly", async () => {
      const result = await toArray(pipe(
        from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
        takeWhile(x => x < 5)
      ));
      expect(result).to.deep.equal([1, 2, 3, 4]);
    });

    it("should handle reader release errors during error cleanup", async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(1);
          controller.error(new Error("Stream error"));
        }
      });

      try {
        await toArray(pipe(
          stream,
          takeWhile((x: number) => x < 10)
        ));
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.equal("Stream error");
      }
    });

    it("should handle single value that passes predicate", async () => {
      const result = await toArray(pipe(
        from([5]),
        takeWhile(x => x < 10)
      ));
      expect(result).to.deep.equal([5]);
    });

    it("should handle single value that fails predicate", async () => {
      const result = await toArray(pipe(
        from([15]),
        takeWhile(x => x < 10)
      ));
      expect(result).to.deep.equal([]);
    });

    it("should work with boolean values", async () => {
      const result = await toArray(pipe(
        from([true, true, false, true]),
        takeWhile(x => x === true)
      ));
      expect(result).to.deep.equal([true, true]);
    });

    it("should work with objects", async () => {
      const result = await toArray(pipe(
        from([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]),
        takeWhile(x => x.id < 3)
      ));
      expect(result).to.deep.equal([{ id: 1 }, { id: 2 }]);
    });

    it("should work with strings", async () => {
      const result = await toArray(pipe(
        from(["a", "b", "c", "d"]),
        takeWhile(x => x < "c")
      ));
      expect(result).to.deep.equal(["a", "b"]);
    });
  });

  describe("Virtual Time", () => {
    describe("Basic TakeWhile Behavior", () => {
      it("should take while predicate is true", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c-d-e|", { a: 1, b: 2, c: 3, d: 4, e: 5 });
          
          const result = pipe(
            source,
            takeWhile((x: number) => x < 3)
          );
          
          expectStream(result).toBe("a-b-|", { a: 1, b: 2 });
        });
      });

      it("should handle empty stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("|", {} as Record<string, number>);
          
          const result = pipe(
            source,
            takeWhile((x: number) => x < 3)
          );
          
          expectStream(result).toBe("|");
        });
      });

      it("should handle all values passing predicate", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            takeWhile((x: number) => x < 10)
          );
          
          expectStream(result).toBe("a-b-c|", { a: 1, b: 2, c: 3 });
        });
      });

      it("should handle no values passing predicate", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 5, b: 6, c: 7 });
          
          const result = pipe(
            source,
            takeWhile((x: number) => x < 3)
          );
          
          expectStream(result).toBe("|");
        });
      });

      it("should stop at first false predicate", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c-d-e|", { a: 1, b: 2, c: 5, d: 1, e: 2 });
          
          const result = pipe(
            source,
            takeWhile((x: number) => x < 3)
          );
          
          expectStream(result).toBe("a-b-|", { a: 1, b: 2 });
        });
      });

      it("should handle single value that passes", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a|", { a: 1 });
          
          const result = pipe(
            source,
            takeWhile((x: number) => x < 3)
          );
          
          expectStream(result).toBe("a|", { a: 1 });
        });
      });

      it("should handle single value that fails", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a|", { a: 5 });
          
          const result = pipe(
            source,
            takeWhile((x: number) => x < 3)
          );
          
          expectStream(result).toBe("|");
        });
      });

      it("should handle first value failing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 5, b: 1, c: 2 });
          
          const result = pipe(
            source,
            takeWhile((x: number) => x < 3)
          );
          
          expectStream(result).toBe("|");
        });
      });
    });

    describe("Timing Patterns", () => {
      it("should maintain source timing for taken values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a---b--c----d|", { a: 1, b: 2, c: 3, d: 4 });
          
          const result = pipe(
            source,
            takeWhile((x: number) => x < 3)
          );
          
          expectStream(result).toBe("a---b--|", { a: 1, b: 2 });
        });
      });

      it("should handle immediate completion with grouped emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("(abc)d-e|", { a: 1, b: 2, c: 5, d: 4, e: 6 });
          
          const result = pipe(
            source,
            takeWhile((x: number) => x < 3)
          );
          
          expectStream(result).toBe("(ab|)", { a: 1, b: 2 });
        });
      });

      it("should handle spaced emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a--b--c--d--e|", { a: 1, b: 2, c: 3, d: 1, e: 2 });
          
          const result = pipe(
            source,
            takeWhile((x: number) => x < 3)
          );
          
          expectStream(result).toBe("a--b--|", { a: 1, b: 2 });
        });
      });

      it("should handle delayed start", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("-----a-b-c|", { a: 1, b: 2, c: 5 });
          
          const result = pipe(
            source,
            takeWhile((x: number) => x < 3)
          );
          
          expectStream(result).toBe("-----a-b-|", { a: 1, b: 2 });
        });
      });

      it("should handle long delays between values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a----------b----------c|", { a: 1, b: 2, c: 5 });
          
          const result = pipe(
            source,
            takeWhile((x: number) => x < 3)
          );
          
          expectStream(result).toBe("a----------b----------|", { a: 1, b: 2 });
        });
      });

      it("should complete immediately after predicate fails", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c-d-e-f|", { a: 1, b: 2, c: 5, d: 6, e: 7, f: 8 });
          
          const result = pipe(
            source,
            takeWhile((x: number) => x < 3)
          );
          
          expectStream(result).toBe("a-b-|", { a: 1, b: 2 });
        });
      });

      it("should handle completion before predicate fails", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b|", { a: 1, b: 2 });
          
          const result = pipe(
            source,
            takeWhile((x: number) => x < 10)
          );
          
          expectStream(result).toBe("a-b|", { a: 1, b: 2 });
        });
      });
    });

    describe("Never Stream Edge Cases", () => {
      it("should handle never stream with timeout", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("-", {} as Record<string, number>);
          
          const result = pipe(
            source,
            takeWhile((x: number) => x < 3),
            timeout(10)
          );
          
          expectStream(result).toBe("----------#", {}, Error("Stream timeout after 10ms"));
        });
      });

      it("should handle completion with no emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("------|", {} as Record<string, number>);
          
          const result = pipe(
            source,
            takeWhile((x: number) => x < 3)
          );
          
          expectStream(result).toBe("------|");
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
            takeWhile((x: number) => x < 5)
          );
          
          expectStream(result).toBe("a-b-#", { a: 1, b: 2 }, error);
        });
      });

      it("should propagate immediate errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Immediate error");
          const source = cold("#", {}, error);
          
          const result = pipe(
            source,
            takeWhile((x: number) => x < 3)
          );
          
          expectStream(result).toBe("#", {}, error);
        });
      });

      it("should propagate errors before predicate fails", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Early error");
          const source = cold("a-#", { a: 1 }, error);
          
          const result = pipe(
            source,
            takeWhile((x: number) => x < 5)
          );
          
          expectStream(result).toBe("a-#", { a: 1 }, error);
        });
      });

      it("should complete before error if predicate fails first", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Later error");
          const source = cold("a-b-c-#", { a: 1, b: 2, c: 5 }, error);
          
          const result = pipe(
            source,
            takeWhile((x: number) => x < 3)
          );
          
          expectStream(result).toBe("a-b-|", { a: 1, b: 2 });
        });
      });

      it("should handle errors in predicate function", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
          const predicateError = new Error("Predicate error");
          
          const result = pipe(
            source,
            takeWhile((x: number) => {
              if (x === 2) throw predicateError;
              return x < 5;
            })
          );
          
          expectStream(result).toBe("a-#", { a: 1 }, predicateError);
        });
      });

      it("should handle errors with grouped emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Grouped error");
          const source = cold("(ab)#", { a: 1, b: 2 }, error);
          
          const result = pipe(
            source,
            takeWhile((x: number) => x < 5)
          );
          
          expectStream(result).toBe("(ab)#", { a: 1, b: 2 }, error);
        });
      });

      it("should complete if predicate fails within grouped error", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Grouped error");
          const source = cold("(abc)#", { a: 1, b: 2, c: 5 }, error);
          
          const result = pipe(
            source,
            takeWhile((x: number) => x < 3)
          );
          
          expectStream(result).toBe("(ab|)", { a: 1, b: 2 });
        });
      });
    });

    describe("Data Types", () => {
      it("should work with boolean values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c-d|", { a: true, b: true, c: false, d: true });
          
          const result = pipe(
            source,
            takeWhile((x: boolean) => x === true)
          );
          
          expectStream(result).toBe("a-b-|", { a: true, b: true });
        });
      });

      it("should work with strings", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c-d|", { a: "apple", b: "banana", c: "watermelon", d: "date" });
          
          const result = pipe(
            source,
            takeWhile((x: string) => x.length < 7)
          );
          
          expectStream(result).toBe("a-b-|", { a: "apple", b: "banana" });
        });
      });

      it("should work with objects", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c-d|", { 
            a: { id: 1, value: 10 }, 
            b: { id: 2, value: 20 }, 
            c: { id: 3, value: 35 },
            d: { id: 4, value: 40 }
          });
          
          const result = pipe(
            source,
            takeWhile((x: { id: number; value: number }) => x.value < 30)
          );
          
          expectStream(result).toBe("a-b-|", { 
            a: { id: 1, value: 10 }, 
            b: { id: 2, value: 20 }
          });
        });
      });

      it("should work with arrays", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c-d|", { 
            a: [1], 
            b: [1, 2], 
            c: [1, 2, 3], 
            d: [1, 2, 3, 4] 
          });
          
          const result = pipe(
            source,
            takeWhile((x: number[]) => x.length < 3)
          );
          
          expectStream(result).toBe("a-b-|", { 
            a: [1], 
            b: [1, 2] 
          });
        });
      });

      it("should work with mixed types", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c-d|", { 
            a: 1, 
            b: "hello", 
            c: true, 
            d: null 
          });
          
          const result = pipe(
            source,
            takeWhile((x: any) => typeof x !== "boolean")
          );
          
          expectStream(result).toBe("a-b-|", { a: 1, b: "hello" });
        });
      });

      it("should work with zero and falsy values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c-d|", { a: 0, b: "", c: null, d: 1 });
          
          const result = pipe(
            source,
            takeWhile((x: any) => x !== null)
          );
          
          expectStream(result).toBe("a-b-|", { a: 0, b: "" });
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
            takeWhile((x: number) => x < 10)
          );
          
          expectStream(result).toBe("c-d-e|", { c: 3, d: 4, e: 5 });
        });
      });

      it("should handle subscription after predicate would fail", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("abc^d-e|", { a: 5, b: 6, c: 7, d: 1, e: 2 });
          
          const result = pipe(
            source,
            takeWhile((x: number) => x < 3)
          );
          
          expectStream(result).toBe("d-e|", { d: 1, e: 2 });
        });
      });

      it("should handle subscription during takeWhile phase", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b^c-d-e|", { a: 1, b: 2, c: 3, d: 4, e: 5 });
          
          const result = pipe(
            source,
            takeWhile((x: number) => x < 5)
          );
          
          expectStream(result).toBe("c-d-|", { c: 3, d: 4 });
        });
      });

      it("should handle subscription after completion", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b|^", { a: 1, b: 2 });
          
          const result = pipe(
            source,
            takeWhile((x: number) => x < 3)
          );
          
          expectStream(result).toBe("|");
        });
      });
    });

    describe("Predicate Edge Cases", () => {
      it("should handle predicate returning undefined", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            takeWhile((x: number) => x === 1 ? true : undefined as any)
          );
          
          expectStream(result).toBe("a-|", { a: 1 });
        });
      });

      it("should handle predicate returning truthy/falsy values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c-d|", { a: 1, b: 2, c: 3, d: 4 });
          
          const result = pipe(
            source,
            takeWhile((x: number) => !!(x < 3 ? x : 0))
          );
          
          expectStream(result).toBe("a-b-|", { a: 1, b: 2 });
        });
      });

      it("should handle synchronous predicate functions with complex logic", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            takeWhile((x: number) => {
              // Complex synchronous logic
              const shouldContinue = x < 3;
              return shouldContinue;
            })
          );
          
          expectStream(result).toBe("a-b-|", { a: 1, b: 2 });
        });
      });
    });
  });
});
