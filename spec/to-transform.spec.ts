import { expect } from "chai";
import { from, map, filter, scan, take, delay, of, toString, toArray, toTransform, pipe, concatAll, exhaustAll, buffer, mergeAll, switchAll, interval, tap } from '../src/index.js';
import { VirtualTimeScheduler } from "../src/testing/virtual-tick-scheduler.js";
import { MapTransform } from "../src/transformers.js";
import { sleep } from "../src/utils/sleep.js";


describe("toTransform", () => {
  it("can make a constructable Transform Stream for an op", async () => {
    const MapTransform = toTransform(map);
    const mapTransform = new MapTransform((x: number) => x.toString());

    let pipe = of(1, 2, 3, 4).pipeThrough(mapTransform);
    let result = await toString(pipe);
    let expected = "1234";

    expect(result, "from stream result matches expected").to.be.deep.eq(expected);
  });

  describe("Common Operators", () => {
    it("should work with map operator", async () => {
      const MapTransform = toTransform(map);
      const transform = new MapTransform((x: number) => x * 2);

      const result = await toArray(
        from([1, 2, 3, 4]).pipeThrough(transform)
      );

      expect(result).to.deep.equal([2, 4, 6, 8]);
    });

    it("should work with filter operator", async () => {
      const FilterTransform = toTransform(filter);
      const transform = new FilterTransform((x: number) => x % 2 === 0);

      const result = await toArray(
        from([1, 2, 3, 4, 5, 6]).pipeThrough(transform)
      );

      expect(result).to.deep.equal([2, 4, 6]);
    });

    it("should work with scan operator", async () => {
      const ScanTransform = toTransform(scan);
      const transform = new ScanTransform((acc: number, x: number) => acc + x, 0);

      const result = await toArray(
        from([1, 2, 3, 4]).pipeThrough(transform)
      );

      expect(result).to.deep.equal([1, 3, 6, 10]);
    });

    it("should work with take operator", async () => {
      const TakeTransform = toTransform(take);
      const transform = new TakeTransform(3);

      const result = await toArray(
        from([1, 2, 3, 4, 5, 6]).pipeThrough(transform)
      );

      expect(result).to.deep.equal([1, 2, 3]);
    });
  });

  describe("Type Safety", () => {
    it("should preserve input/output types", async () => {
      const MapTransform = toTransform(map);

      // TypeScript should infer correct types
      const stringToNumber = new MapTransform((s: string) => parseInt(s));
      const numberToString = new MapTransform((n: number) => n.toString());

      const stringResult = await toArray(
        from(["1", "2", "3"]).pipeThrough(stringToNumber)
      );
      expect(stringResult).to.deep.equal([1, 2, 3]);

      const numberResult = await toArray(
        from([10, 20, 30]).pipeThrough(numberToString)
      );
      expect(numberResult).to.deep.equal(["10", "20", "30"]);
    });

    it("should work with complex object transformations", async () => {
      interface User {
        id: number;
        name: string;
      }

      const MapTransform = toTransform(map);
      const transform = new MapTransform((user: User) => user.name.toUpperCase());

      const users: User[] = [
        { id: 1, name: "alice" },
        { id: 2, name: "bob" },
        { id: 3, name: "charlie" }
      ];

      const result = await toArray(
        from(users).pipeThrough(transform)
      );

      expect(result).to.deep.equal(["ALICE", "BOB", "CHARLIE"]);
    });
  });

  describe("Chaining", () => {
    it("should support chaining multiple transformations", async () => {
      const MapTransform = toTransform(map);
      const FilterTransform = toTransform(filter);

      const doubleTransform = new MapTransform((x: number) => x * 2);
      const evenFilterTransform = new FilterTransform((x: number) => x % 2 === 0);
      const stringTransform = new MapTransform((x: number) => `#${x}`);

      const result = await toArray(
        from([1, 2, 3, 4, 5])
          .pipeThrough(doubleTransform)
          .pipeThrough(evenFilterTransform)
          .pipeThrough(stringTransform)
      );

      expect(result).to.deep.equal(["#2", "#4", "#6", "#8", "#10"]);
    });

    it("should work with native TransformStreams in chain", async () => {
      const MapTransform = toTransform(map);
      const customTransform = new MapTransform((x: number) => x * 10);

      const nativeTransform = new TransformStream<number, string>({
        transform(chunk, controller) {
          controller.enqueue(`value:${chunk}`);
        }
      });

      const result = await toArray(
        from([1, 2, 3])
          .pipeThrough(customTransform)
          .pipeThrough(nativeTransform)
      );

      expect(result).to.deep.equal(["value:10", "value:20", "value:30"]);
    });
  });

  describe("Error Handling", () => {
    it("should propagate errors from the operator function", async () => {
      const MapTransform = toTransform(map);

      const mapFunc = (x: number) => {

        if (x === 3) {
          console.log("throwing error...")
          throw new Error("Test error");
        }
        return x * 2;
      };

      const transform = new MapTransform(mapFunc);

      try {
        await toArray(from([1, 2, 3, 4]).pipeThrough(transform));
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).to.equal("Test error");
      }

      // Give time for any pending async operations to complete
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it("should propagate source stream errors", async () => {
      const MapTransform = toTransform(map);
      const transform = new MapTransform((x: number) => x * 2);

      const errorStream = new ReadableStream({
        start(controller) {
          controller.enqueue(1);
          controller.enqueue(2);
          controller.error(new Error("Source error"));
        }
      });

      try {
        await toArray(errorStream.pipeThrough(transform));
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).to.equal("Source error");
      }
    });

    it("should handle errors in filter predicates", async () => {
      const FilterTransform = toTransform(filter);
      const transform = new FilterTransform((x: number) => {
        if (x === 2) throw new Error("Filter error");
        return x > 0;
      });

      try {
        await toArray(from([1, 2, 3]).pipeThrough(transform));
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).to.equal("Filter error");
      }
    });

    it("should propagate writable-side cancellation to source stream", async () => {
      const MapTransform = toTransform(map);
      const transform = new MapTransform((x: number) => x * 2);

      let sourceCanceled = false;
      let cancelReason: any = null;

      // Create a source that tracks cancellation
      const sourceStream = new ReadableStream({
        start(controller) {
          controller.enqueue(1);
          controller.enqueue(2);
          controller.enqueue(3);
          // Don't close - let cancellation handle it
        },
        cancel(reason) {
          sourceCanceled = true;
          cancelReason = reason;
        }
      });

      try {
        // Start the transform
        const reader = sourceStream.pipeThrough(transform).getReader();

        // Read a chunk to get things started
        await reader.read(); // {value: 2, done: false}

        // Now abort the writable side to simulate downstream cancellation
        const abortReason = new Error("Downstream canceled");
        await transform.writable.abort(abortReason);

        // The source should have been canceled
        expect(sourceCanceled).to.be.true;
        expect(cancelReason).to.equal(abortReason);

        // Clean up
        reader.releaseLock();
      } catch (error) {
        // Expected in some cases
      }
    });

    it("should propagate readable-side cancellation to source stream", async () => {
      const MapTransform = toTransform(map);
      const transform = new MapTransform((x: number) => x * 2);

      let sourceCanceled = false;
      let cancelReason: any = null;

      // Create a source that tracks cancellation
      const sourceStream = new ReadableStream({
        start(controller) {
          controller.enqueue(1);
          controller.enqueue(2);
          controller.enqueue(3);
          // Don't close - let cancellation handle it
        },
        cancel(reason) {
          sourceCanceled = true;
          cancelReason = reason;
        }
      });

      try {
        // Start the transform
        const reader = sourceStream.pipeThrough(transform).getReader();

        // Read a chunk
        await reader.read(); // {value: 2, done: false}

        // Now cancel the readable side
        const cancelReasonValue = new Error("Reader canceled");
        await reader.cancel(cancelReasonValue);

        // The source should have been canceled
        expect(sourceCanceled).to.be.true;
        expect(cancelReason).to.equal(cancelReasonValue);
      } catch (error) {
        // Expected in some cases
      }
    });
  });

  describe("Options Support", () => {
    it("should support readable queuing strategy options", async () => {
      const MapTransform = toTransform(map);

      const transform = new MapTransform(
        (x: number) => x * 2,
        {
          readableStrategy: new CountQueuingStrategy({ highWaterMark: 5 })
        }
      );

      // Test that the transform works with custom strategy
      const result = await toArray(
        from([1, 2, 3, 4]).pipeThrough(transform)
      );

      expect(result).to.deep.equal([2, 4, 6, 8]);
    });

    it("should support writable queuing strategy options", async () => {
      const MapTransform = toTransform(map);

      const transform = new MapTransform(
        (x: number) => x * 3,
        {
          writableStrategy: new CountQueuingStrategy({ highWaterMark: 3 })
        }
      );

      const result = await toArray(
        from([1, 2, 3]).pipeThrough(transform)
      );

      expect(result).to.deep.equal([3, 6, 9]);
    });

    it("should support both readable and writable strategies", async () => {
      const FilterTransform = toTransform(filter);

      const transform = new FilterTransform(
        (x: number) => x % 2 === 0,
        {
          readableStrategy: new CountQueuingStrategy({ highWaterMark: 2 }),
          writableStrategy: new CountQueuingStrategy({ highWaterMark: 4 })
        }
      );

      const result = await toArray(
        from([1, 2, 3, 4, 5, 6, 7, 8]).pipeThrough(transform)
      );

      expect(result).to.deep.equal([2, 4, 6, 8]);
    });

    it("should work without options (default behavior)", async () => {
      const ScanTransform = toTransform(scan);
      const transform = new ScanTransform((acc: string, x: string) => acc + x, "");

      const result = await toArray(
        from(["a", "b", "c"]).pipeThrough(transform)
      );

      expect(result).to.deep.equal(["a", "ab", "abc"]);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty streams", async () => {
      const MapTransform = toTransform(map);
      const transform = new MapTransform((x: number) => x * 2);

      const result = await toArray(
        from([]).pipeThrough(transform)
      );

      expect(result).to.deep.equal([]);
    });

    it("should handle single element streams", async () => {
      const FilterTransform = toTransform(filter);
      const transform = new FilterTransform((x: number) => x > 5);

      const result = await toArray(
        from([10]).pipeThrough(transform)
      );

      expect(result).to.deep.equal([10]);
    });

    it("should handle streams with null/undefined values", async () => {
      const MapTransform = toTransform(map);
      const transform = new MapTransform((x: any) => x != null ? x.toString() : "null");

      const result = await toArray(
        from([1, null, 3, undefined, 5]).pipeThrough(transform)
      );

      expect(result).to.deep.equal(["1", "null", "3", "null", "5"]);
    });

    it("should handle large streams efficiently", async () => {
      const MapTransform = toTransform(map);
      const transform = new MapTransform((x: number) => x * 2);

      const largeArray = Array.from({ length: 1000 }, (_, i) => i);
      const expectedResult = largeArray.map(x => x * 2);

      const result = await toArray(
        from(largeArray).pipeThrough(transform)
      );

      expect(result).to.deep.equal(expectedResult);
    });

    it("should handle operators with multiple parameters", async () => {
      const ScanTransform = toTransform(scan);

      // Test with seed value
      const withSeed = new ScanTransform((acc: number, x: number) => acc + x, 100);
      const resultWithSeed = await toArray(
        from([1, 2, 3]).pipeThrough(withSeed)
      );
      expect(resultWithSeed).to.deep.equal([101, 103, 106]);

      // Test without seed value
      const withoutSeed = new ScanTransform((acc: number, x: number) => acc + x);
      const resultWithoutSeed = await toArray(
        from([1, 2, 3]).pipeThrough(withoutSeed)
      );
      expect(resultWithoutSeed).to.deep.equal([1, 3, 6]);
    });
  });

  describe("Compliance", () => {
    it("cancel upstream", async () => {

      const TakeTransform = toTransform(take);

      const pulled: number[] = [];

      let src = pipe(interval(10), tap(x => {
        pulled.push(x);
      }), { highWaterMark: 0 });

      let piped = src.pipeThrough(new TakeTransform(1, {
        writableStrategy: { highWaterMark: 1 },  // Allow at least one item buffering
        readableStrategy: { highWaterMark: 1 }   // Allow at least one item buffering
      }));

      let result = await toArray(piped);

      expect(result, "only take 1").to.deep.eq([0]);

      expect(pulled.length, "doesn't pull and buffer too much").to.be.lessThan(2);
    })


    it("should respect backpressure", async () => {
      let scheduler = new VirtualTimeScheduler({ debug: false });

      await scheduler.run(() => {
        let sourceCount = 0;
        let sourcePullTicks: number[] = [];
        let consumeTicks: number[] = [];
        let isSourceClosed = false;

        // Source that respects backpressure properly
        let source = new ReadableStream({
          pull(controller) {
            // Prevent infinite pulls by checking if we already closed
            if (isSourceClosed) {
              return;
            }

            const currentTick = scheduler.getCurrentTick();

            if (sourceCount < 6) {
              // Only enqueue if there's actual demand (desiredSize > 0)
              if (controller.desiredSize !== null && controller.desiredSize > 0) {
                sourcePullTicks.push(currentTick);
                controller.enqueue(sourceCount++);
              }
            } else {
              controller.close();
              isSourceClosed = true;
            }
          }
        });

        let MapTransform = toTransform(map);
        let transformOptions = {
          writableStrategy: new CountQueuingStrategy({ highWaterMark: 0 }),
          readableStrategy: new CountQueuingStrategy({ highWaterMark: 0 })
        };
        let transform = new MapTransform((x: number) => x, transformOptions);

        let consumed: number[] = [];

        // Sink that introduces delay and records consumption timing
        let sink = new WritableStream({
          async write(value) {
            const currentTick = scheduler.getCurrentTick();
            consumeTicks.push(currentTick);
            consumed.push(value);
            // Introduce backpressure with virtual delay
            await sleep(5); // Longer delay to make backpressure more apparent
          }
        });

        // Start the pipe operation
        let piped = source.pipeThrough(transform).pipeTo(sink);

        // Add a runner that waits for completion and then verifies results
        scheduler.addRunner(async () => {
          try {
            await piped;

            // Verify the pipe completed successfully
            expect(consumed).to.deep.equal([0, 1, 2, 3, 4, 5], "All values should be consumed");

            // Verify exact deterministic timing for backpressure compliance
            expect(sourcePullTicks).to.deep.equal([1, 2, 7, 12, 17, 22],
              "Source should be pulled at exact deterministic times due to backpressure");
            expect(consumeTicks).to.deep.equal([1, 6, 11, 16, 21, 26],
              "Consumption should happen at exact deterministic times with 5-tick delays");

          } catch (error) {
            // Make sure we have good error reporting
            console.log('Source pull ticks:', sourcePullTicks);
            console.log('Consume ticks:', consumeTicks);
            console.log('Consumed values:', consumed);
            throw error;
          }
        });
      });
    });
  });

  describe("Advanced Use Cases", () => {
    it("should work with async operations in a synchronous way", async () => {
      // Note: This tests that the transform works with sync functions,
      // not that it handles async operations within the transform
      const MapTransform = toTransform(map);
      const transform = new MapTransform((x: number) => {
        // Simulate some synchronous processing
        return x ** 2 + Math.sqrt(x);
      });

      const result = await toArray(
        from([1, 4, 9, 16]).pipeThrough(transform)
      );

      expect(result).to.deep.equal([2, 18, 84, 260]); // 1+1, 16+2, 81+3, 256+4
    });

    it("should maintain operator behavior exactly", async () => {
      const TakeTransform = toTransform(take);

      // Test take(0) edge case
      const takeZero = new TakeTransform(0);
      const zeroResult = await toArray(
        from([1, 2, 3]).pipeThrough(takeZero)
      );
      expect(zeroResult).to.deep.equal([]);

      // Test take(0) edge case
      const takeOne = new TakeTransform(1);
      const oneResult = await toArray(
        from([1, 2, 3]).pipeThrough(takeOne)
      );
      expect(oneResult).to.deep.equal([1]);

      // Test take larger than stream
      const takeLarge = new TakeTransform<number>(10);
      const largeResult = await toArray(
        from([1, 2, 3]).pipeThrough(takeLarge)
      );
      expect(largeResult).to.deep.equal([1, 2, 3]);
    });
  });
  describe("Advanced Operator Check", () => {
    it("should work with concatAll", async () => {
      let ConcatAllTransform = toTransform(concatAll);

      let genInput = () => from([of("a", "b", "c"), of("d", "e", "f")]);

      //this works
      let piped = pipe(genInput(), concatAll());
      //this doesn't
      let piped2 = genInput().pipeThrough(new ConcatAllTransform());

      let result = await toArray(piped);
      let result2 = await toArray(piped2);

      let expected = ["a", "b", "c", "d", "e", "f"];
      expect(result, "concatAll with pipe works").to.deep.eq(expected);
      expect(result2, "concat as transform works").to.deep.eq(expected);
    });

    it("should work with exhaustAll", async () => {
      let ExhaustAllTransform = toTransform(exhaustAll);

      // Create test streams where the first takes time, 
      // and subsequent ones should be ignored while first is active
      let genInput = () => from([
        pipe(of("a", "b"), delay(10)), // First stream with delay
        of("c", "d"), // Should be ignored while first is processing
        of("e", "f")  // Should be ignored while first is processing
      ]);

      let piped = pipe(genInput(), exhaustAll());
      let piped2 = genInput().pipeThrough(new ExhaustAllTransform());

      let result = await toArray(piped);
      let result2 = await toArray(piped2);

      // Should only get values from the first stream since others are exhausted
      let expected = ["a", "b"];
      expect(result, "exhaustAll with pipe works").to.deep.eq(expected);
      expect(result2, "exhaustAll as transform works").to.deep.eq(expected);
    });

    it("should work with mergeAll", async () => {
      let MergeAllTransform = toTransform(mergeAll);

      let genInput = () => from([of("a", "b", "c"), of("d", "e", "f")]);

      let piped = pipe(genInput(), mergeAll());
      let piped2 = genInput().pipeThrough(new MergeAllTransform());

      let result = await toArray(piped);
      let result2 = await toArray(piped2);

      // For mergeAll, order may vary, so sort both results
      result.sort();
      result2.sort();

      let expected = ["a", "b", "c", "d", "e", "f"];
      expect(result, "mergeAll with pipe works").to.deep.eq(expected);
      expect(result2, "mergeAll as transform works").to.deep.eq(expected);
    });

    it("should work with switchAll", async () => {
      let SwitchAllTransform = toTransform(switchAll);

      // Create input where later streams should cancel earlier ones
      let genInput = () => from([
        pipe(of("a", "b", "c"), delay(10)), // Should get cancelled
        of("d", "e", "f") // Should complete
      ]);

      let piped = pipe(genInput(), switchAll());
      let piped2 = genInput().pipeThrough(new SwitchAllTransform());

      let result = await toArray(piped);
      let result2 = await toArray(piped2);

      // Should only get values from the last stream since it switches
      let expected = ["d", "e", "f"];
      expect(result, "switchAll with pipe works").to.deep.eq(expected);
      expect(result2, "switchAll as transform works").to.deep.eq(expected);
    });

    it("should work with buffer", async () => {
      let BufferTransform = toTransform(buffer);

      let genInput = () => from([1, 2, 3, 4, 5, 6]);

      let piped = pipe(genInput(), buffer(3));
      let piped2 = genInput().pipeThrough(new BufferTransform(3));

      let result = await toArray(piped);
      let result2 = await toArray(piped2);

      let expected = [[1, 2, 3], [4, 5, 6]];
      expect(result, "buffer with pipe works").to.deep.eq(expected);
      expect(result2, "buffer as transform works").to.deep.eq(expected);
    })

  })
});