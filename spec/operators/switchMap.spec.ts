import { expect } from "chai";
import { from, pipe, switchMap, toArray, Subject, map, take, timeout } from "../../src/index.js";
import { interval } from "../../src/interval.js";
import { VirtualTimeScheduler } from "../../src/testing/virtual-tick-scheduler.js";
import { unlink } from "fs";


describe("switchMap", () => {
  describe("Real Time", () => {
    it("should handle basic switchMap with completed streams", async () => {
    const input = [1, 2, 3];
    
    const result = await toArray(pipe(
      from(input),
      switchMap(x => from([x * 10]))
    ));
    
    // With completed input stream, last inner stream should emit
    expect(result).to.include(30);
  });

  it("should handle empty inner streams", async () => {
    const input = [1, 2, 3];
    
    const result = await toArray(pipe(
      from(input),
      switchMap(x => from([])) // Empty streams
    ));
    
    expect(result).to.deep.equal([]);
  });

  it("should handle errors in projection function", async () => {
    const input = [1, 2, 3];
    
    try {
      await toArray(pipe(
        from(input),
        switchMap(x => {
          if (x === 2) throw new Error("Projection error");
          return from([x * 10]);
        })
      ));
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.equal("Projection error");
    }
  });

  it("should pass index to projection function", async () => {
    const input = [10];
    
    const result = await toArray(pipe(
      from(input),
      switchMap((value, index) => from([value + index]))
    ));
    
    expect(result).to.deep.equal([10]);
  });

  it("should work with different types", async () => {
    const input = ['c'];
    
    const result = await toArray(pipe(
      from(input),
      switchMap(letter => from([letter.toUpperCase()]))
    ));
    
    expect(result).to.deep.equal(['C']);
  });

  it("should handle single value switching", async () => {
    const result = await toArray(pipe(
      from([1]),
      switchMap(x => from([x * 100])) // Fast inner streams
    ));
    
    expect(result).to.deep.equal([100]);
  });

  it("should handle simple async case", async () => {
    const subject = new Subject<number>();
    
    const resultPromise = toArray(pipe(
      subject.readable,
      switchMap(x => from([x * 100]))
    ));
    
    subject.next(1);
    subject.complete();
    
    const result = await resultPromise;
    expect(result).to.deep.equal([100]);
  });

  it("should handle source stream errors", async () => {
    const subject = new Subject<number>();
    const errorMessage = "source error";
    
    const resultPromise = toArray(pipe(
      subject.readable,
      switchMap(x => from([x * 10]))
    ));
    
    subject.error(new Error(errorMessage));
    
    try {
      await resultPromise;
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.equal(errorMessage);
    }
  });

  it("should handle promises that resolve to streams", async () => {
    const result = await toArray(pipe(
      from([1, 2]),
      switchMap(x => Promise.resolve(from([x * 10])))
    ));
    
    expect(result.length).to.be.greaterThan(0);
    expect(result).to.include(20); // Should get at least the last value
  });

  it("should work with custom highWaterMark", async () => {
    const source = from([1, 2, 3]);
    
    const result = await toArray(
      switchMap((x: number) => from([x * 10]))(source, { highWaterMark: 1 })
    );
    
    expect(result.length).to.be.greaterThan(0);
    expect(result).to.include(30);
  });

  it("should handle empty source stream", async () => {
    const result = await toArray(pipe(
      from([]),
      switchMap(x => from([x * 10]))
    ));
    
    expect(result).to.deep.equal([]);
  });

  it("should handle multiple rapid switches", async () => {
    const result = await toArray(pipe(
      from([1, 2, 3, 4, 5]),
      switchMap(x => from([x * 10]))
    ));
    
    // Should get at least the last value
    expect(result).to.include(50);
  });

  it("should handle multiple switches with delay - deterministic timing", async () => {
    // Use interval + map to create a source that emits values at constant intervals
    const delayedSource = pipe(
      interval(10), // 10ms intervals
      take(5),      // Take only 5 values (0, 1, 2, 3, 4)
      map(i => i + 1) // Convert to (1, 2, 3, 4, 5)
    );
    
    const result = await toArray(pipe(
      delayedSource,
      switchMap(x => from([x * 10]))
    ));
    
    // With constant timing and synchronous inner streams, each inner stream
    // has time to emit its value before the next source value arrives
    expect(result).to.deep.equal([10, 20, 30, 40, 50]);
  });

  it("should match RxJS switchMap behavior with synchronous inner observables", async () => {
    // Replicate the RxJS example: of(1, 2, 3).pipe(switchMap(x => of(x, x ** 2, x ** 3)))
    // With synchronous streams, switching cancels previous inner stream
    const result = await toArray(pipe(
      from([1, 2, 3]),
      switchMap(x => from([x, x ** 2, x ** 3]))
    ));
    
    // With synchronous source and inner streams, switchMap cancels previous inner streams
    // when new source values arrive, so we get partial results from earlier streams
    expect(result).to.deep.equal([1, 2, 3, 9, 27]);
  });

  it("should complete when source completes and no inner stream", async () => {
    const subject = new Subject<number>();
    
    const resultPromise = toArray(pipe(
      subject.readable,
      switchMap(x => from([x * 10]))
    ));
    
    // Complete source without emitting any values
    subject.complete();
    
    const result = await resultPromise;
    expect(result).to.deep.equal([]);
  });

  it('should handle reader lock release during cancellation', async () => {
    // Test to cover lines 85-88 (sourceReader releaseLock and null assignment)
    const source = from([1, 2, 3]);
    
    const switchMapped = pipe(
      source,
      switchMap(async (x: number) => {
        return from([x * 10]);
      })
    );

    const reader = switchMapped.getReader();
    
    // Start reading but cancel before completion to trigger cancellation logic
    const readPromise = reader.read();
    reader.cancel(); // This should trigger the cancel() method covering lines 85-88
    
    try {
      await readPromise;
    } catch (err) {
      // Cancel may cause read to reject
    }
  });

  it('should properly clean up when cancelled during inner stream reading', async () => {
    // Test to ensure lines 97-98 (currentInnerReader = null) are covered
    const source = from([1]);
    let innerReaderCancelCalled = false;
    
    const switchMapped = pipe(
      source,
      switchMap(async (x: number) => {
        return new ReadableStream({
          start(controller) {
            // Don't close immediately to allow cancellation during reading
            controller.enqueue(x * 10);
          },
          cancel() {
            innerReaderCancelCalled = true;
          }
        });
      })
    );

    const reader = switchMapped.getReader();
    
    // Start reading but cancel before reading all values
    const readPromise = reader.read();
    const result = await readPromise;
    expect(result.value).to.equal(10);
    
    // Cancel while inner reader is active
    reader.cancel();
    
    // Verify inner reader was cancelled
    expect(innerReaderCancelCalled).to.be.true;
  });

  it('should pass AbortSignal to projection function for proper cancellation', async () => {
    const abortSignals: AbortSignal[] = [];
    const results: any[] = [];
    
    const source = new Subject<string>();
    
    const switchMappedStream = pipe(
      source.readable,
      switchMap((value, index, signal) => {
        // Capture the signal for verification
        if (signal) {
          abortSignals.push(signal);
        }
        
        // Simulate an async operation that can be cancelled
        return new ReadableStream({
          start(controller) {
            const timer = setTimeout(() => {
              if (!signal?.aborted) {
                try {
                  controller.enqueue(`${value}-result`);
                  controller.close();
                } catch (e) {
                  // Controller might already be closed, ignore
                }
              }
            }, 50);
            
            signal?.addEventListener('abort', () => {
              clearTimeout(timer);
              try {
                controller.close();
              } catch (e) {
                // Controller might already be closed, ignore
              }
            });
          }
        });
      })
    );
    
    // Start consuming the stream
    const reader = switchMappedStream.getReader();
    const readPromise = (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          results.push(value);
        }
      } catch (error) {
        // Ignore errors from cancelled operations
      }
    })();
    
    // Emit values rapidly to trigger switching
    await source.next('first');
    await source.next('second');
    await source.next('third');
    
    // Wait a bit longer than the timer to ensure completion
    await new Promise(resolve => setTimeout(resolve, 100));
    await source.complete();
    await readPromise;
    
    // Verify AbortSignals were provided
    expect(abortSignals.length).to.equal(3);
    abortSignals.forEach(signal => {
      expect(signal).to.be.instanceOf(AbortSignal);
    });
    
    // Verify that earlier signals were aborted when new values arrived
    expect(abortSignals[0].aborted).to.be.true;  // first signal aborted by second
    expect(abortSignals[1].aborted).to.be.true;  // second signal aborted by third
    expect(abortSignals[2].aborted).to.be.false; // third signal not aborted (completed normally)
    
    // Verify only the last operation completed
    expect(results).to.deep.equal(['third-result']);
  });

  it('should switch at precise timings', async () => {
      // Create async generators with precise timing
      async function* firstStream() {
        await new Promise(resolve => setTimeout(resolve, 50));
        yield 'a'; // At 50ms
        await new Promise(resolve => setTimeout(resolve, 50));
        yield 'b'; // At 100ms
        await new Promise(resolve => setTimeout(resolve, 100)); // Longer delay
        yield 'c'; // At 200ms (this should be cancelled)
        await new Promise(resolve => setTimeout(resolve, 100));
        yield 'd'; // At 300ms (this should be cancelled)
      }
  
      async function* secondStream() {
        await new Promise(resolve => setTimeout(resolve, 50));
        yield 'e'; // At 50ms when this stream starts
        await new Promise(resolve => setTimeout(resolve, 50));
        yield 'f'; // At 100ms from when second stream starts
        await new Promise(resolve => setTimeout(resolve, 50));
        yield 'g'; // At 150ms from when second stream starts
      }
  
      const source = new Subject<ReadableStream<string>>();
      const stream = pipe(source.readable, switchMap(x=>x));
      const reader = stream.getReader();
      const results: string[] = [];
  
      // Start reading in background
      const readPromise = (async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            results.push(value);
          }
        } catch (error) {
          // Stream was cancelled
        }
      })();
  
      // Send first stream immediately
      source.next(from(firstStream()));
  
      // Wait for 'a' and 'b' to be emitted, but before 'c'
      // C will be emitted 200ms from when the first stream starts
      // but if we switch to the second stream before that, 'c' should be cancelled
      await new Promise(resolve => setTimeout(resolve, 120)); // emit after a and b (100ms at least)
  
      // At this point we should have received 'a' and 'b'
      // Now send the second stream to trigger the switch (before 'c' is emitted)
      source.next(from(secondStream()));
  
      // Wait for second stream to complete
      await new Promise(resolve => setTimeout(resolve, 200));
  
      // Complete the source
      source.complete();
  
      // Wait for reading to finish
      await readPromise;
  
      // Verify the expected sequence: a, b, then switch to e, f, g
      // The 'c' and 'd' from first stream should be cancelled
      expect(results).to.deep.equal(['a', 'b', 'e', 'f', 'g']);
    });
  });

  describe("Virtual Time", () => {
    describe("Basic SwitchMap Behavior", () => {
      it("should switch to latest projected stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            switchMap((x: number) => cold("  x-y|", { x: x * 10, y: x * 10 + 1 }))
          );
          
          // switchMap cancels previous projections when new values arrive
          // a=1 at tick 0: projects to cold("  x-y|"), x=10 at tick 0
          // b=2 at tick 2: cancels first projection, projects new cold("  x-y|"), x=20 at tick 2  
          // c=3 at tick 4: cancels second projection, projects new cold("  x-y|"), x=30 at tick 4, y=31 at tick 6
          expectStream(result).toBe("a-b-c-d|", { a: 10, b: 20, c: 30, d: 31 });
        });
      });

      it("should emit all values from single projection", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a|", { a: 1 });
          
          const result = pipe(
            source,
            switchMap(x => cold("  x-y-z|", { x: x * 10, y: x * 10 + 1, z: x * 10 + 2 }))
          );
          
          expectStream(result).toBe("x-y-z|", { x: 10, y: 11, z: 12 });
        });
      });

      it("should cancel previous projection when switching", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a--b|", { a: 1, b: 2 });
          
          const result = pipe(
            source,
            switchMap((x: number) => cold("  x---y---z|", { x: x * 10, y: x * 10 + 1, z: x * 10 + 2 }))
          );
          
          // First projection: a=1 at tick 0, x=10 at tick 0
          // At tick 3: switch to second projection: b=2, x=20 at tick 3, y=21 at tick 7, z=22 at tick 11
          expectStream(result).toBe("a--b---c---d|", { a: 10, b: 20, c: 21, d: 22 });
        });
      });

      it("should handle immediate switch", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("(ab)|", { a: 1, b: 2 });
          
          const result = pipe(
            source,
            switchMap(x => cold("  x-y|", { x: x * 10, y: x * 10 + 1 }))
          );
          
          // Both projections start at same time, but switch immediately to second
          expectStream(result).toBe("x-y|", { x: 20, y: 21 });
        });
      });

      it("should handle empty projections", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b|", { a: 1, b: 2 });
          
          const result = pipe(
            source,
            switchMap(x => cold("  |"))
          );
          
          expectStream(result).toBe("---|");
        });
      });

      it("should handle never-ending projection", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a|", { a: 1 });
          
          const result = pipe(
            source,
            switchMap(x => cold("  x-y-", { x: x * 10, y: x * 10 + 1 })),
            timeout(10)
          );
          
          expectStream(result).toBe("x-y---------#", { x: 10, y: 11 }, Error("Stream timeout after 10ms"));
        });
      });
    });

    describe("Timing Patterns", () => {
      it("should maintain projection timing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a|", { a: 1 });
          
          const result = pipe(
            source,
            switchMap(x => cold("  x---y--z|", { x: x * 10, y: x * 10 + 1, z: x * 10 + 2 }))
          );
          
          expectStream(result).toBe("x---y--z|", { x: 10, y: 11, z: 12 });
        });
      });

      it("should handle late switching", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a---b|");
          
          const result = pipe(
            source,
            switchMap(x => cold("x-y-z|"))
          );
          
          expectStream(result).toBe("x-y-x-y-z|");
        });
      });

      it("should handle rapid switching", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|");
          
          const result = pipe(
            source,
            switchMap(x => cold("x-y|"))
          );
          
          // Each projection starts but gets cancelled by the next
          expectStream(result).toBe("x-x-x-y|");
        });
      });

      it("should handle grouped source emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("(abc)|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            switchMap(x => cold("  x-y|", { x: x * 10, y: x * 10 + 1 }))
          );
          
          // All projections start simultaneously, but only last one continues
          expectStream(result).toBe("x-y|", { x: 30, y: 31 });
        });
      });

      it("should handle delayed source start", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("-----a|", { a: 1 });
          
          const result = pipe(
            source,
            switchMap(x => cold("  x-y|", { x: x * 10, y: x * 10 + 1 }))
          );
          
          expectStream(result).toBe("-----x-y|", { x: 10, y: 11 });
        });
      });

      it("should handle spaced projections", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a--b--c|");
          
          const result = pipe(
            source,
            switchMap(x => cold("x-y|"))
          );
          
          expectStream(result).toBe("x-yx-yx-y|");
        });
      });
    });

    describe("Empty and Edge Cases", () => {
      it("should handle empty source stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("|", {} as Record<string, number>);
          
          const result = pipe(
            source,
            switchMap(x => cold("  x|", { x: x * 10 }))
          );
          
          expectStream(result).toBe("|");
        });
      });

      it("should handle never source stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("-", {} as Record<string, number>);
          
          const result = pipe(
            source,
            switchMap(x => cold("  x|", { x: x * 10 })),
            timeout(10)
          );
          
          expectStream(result).toBe("----------#", {}, Error("Stream timeout after 10ms"));
        });
      });

      it("should handle source with only empty projections", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b|");
          
          const result = pipe(
            source,
            switchMap(x => cold("|"))
          );
          
          expectStream(result).toBe("---|");
        });
      });

      it("should handle completion during projection", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a--|", { a: 1 });
          
          const result = pipe(
            source,
            switchMap(x => cold("  x-y-z-w|", { x: x * 10, y: x * 10 + 1, z: x * 10 + 2, w: x * 10 + 3 }))
          );
          
          // Source completes at tick 3, but projection continues until it completes
          expectStream(result).toBe("x-y-z-w|", { x: 10, y: 11, z: 12, w: 13 });
        });
      });

      it("should handle never projection", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a|");
          
          const result = pipe(
            source,
            switchMap(x => cold("x-y-")),
            timeout(10)
          );
          
          expectStream(result).toBe("x-y---------#",undefined,  Error("Stream timeout after 10ms"));
        });
      });
    });

    describe("Error Handling", () => {
      it("should propagate source stream errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Source error");
          const source = cold("a-#", { a: 1 }, error);
          
          const result = pipe(
            source,
            switchMap(x => cold("  x|", { x: x * 10 }))
          );
          
          expectStream(result).toBe("x-#", { x: 10 }, error);
        });
      });

      it("should propagate projection errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Projection error");
          const source = cold("a|", { a: 1 });
          
          const result = pipe(
            source,
            switchMap(x => cold("  x-#", { x: x * 10 }, error))
          );
          
          expectStream(result).toBe("x-#", { x: 10 }, error);
        });
      });

      it("should propagate errors from latest projection", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Latest projection error");
          const source = cold("a-b|");
          
          const result = pipe(
            source,
            switchMap(x => {
              if (x === 'b') {
                return cold("x-#", undefined,  error);
              }
              return cold("x-y|");
            })
          );
          
          expectStream(result).toBe("x-x-#", undefined, error);
        });
      });

      it("should handle immediate source error", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Immediate error");
          const source = cold("#", {}, error);
          
          const result = pipe(
            source,
            switchMap(x => cold("  x|", { x: Number(x) * 10 }))
          );
          
          expectStream(result).toBe("#", {}, error);
        });
      });

      it("should handle immediate projection error", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Immediate projection error");
          const source = cold("a|", { a: 1 });
          
          const result = pipe(
            source,
            switchMap(x => cold("  #", {}, error))
          );
          
          expectStream(result).toBe("#", {}, error);
        });
      });

      it("should handle error during switch", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Switch error");
          const source = cold("a-b|", { a: 1, b: 2 });
          
          const result = pipe(
            source,
            switchMap(x => {
              if (x === 2) {
                return cold("  #", {}, error);
              }
              return cold("  x-y|", { x: x * 10, y: x * 10 + 1 });
            })
          );
          
          expectStream(result).toBe("x-#", { x: 10 }, error);
        });
      });

      it("should handle error in projection function", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Projection function error");
          const source = cold("a-b|", { a: 1, b: 2 });
          
          const result = pipe(
            source,
            switchMap(x => {
              if (x === 2) {
                throw error;
              }
              return cold("  x-y|", { x: x * 10, y: x * 10 + 1 });
            })
          );
          
          expectStream(result).toBe("x-#", { x: 10 }, error);
        });
      });

      it("should handle error with grouped emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Grouped error");
          const source = cold("a|", { a: 1 });
          
          const result = pipe(
            source,
            switchMap(x => cold("  (xy)#", { x: x * 10, y: x * 10 + 1 }, error))
          );
          
          expectStream(result).toBe("(xy)#", { x: 10, y: 11 }, error);
        });
      });
    });

    describe("Data Types", () => {
      it("should work with string projections", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b|", { a: "hello", b: "world" });
          
          const result = pipe(
            source,
            switchMap(x => cold("x-y|", { x: x.toUpperCase(), y: x.toLowerCase() }))
          );
          
          expectStream(result).toBe("a-b-c|", { a: "HELLO", b: "WORLD", c: "world" });
        });
      });

      it("should work with object projections", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b|", { 
            a: { id: 1, name: "first" }, 
            b: { id: 2, name: "second" } 
          });
          
          const result = pipe(
            source,
            switchMap(x => cold("  x|", { x: { ...x, processed: true } }))
          );
          
          expectStream(result).toBe("a-b|", { 
            a: { id: 1, name: "first", processed: true },
            b: { id: 2, name: "second", processed: true }
          });
        });
      });

      it("should work with mixed type projections", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 1, b: "hello", c: true });
          
          const result = pipe(
            source,
            switchMap(x => cold("  x|", { x: String(x) }))
          );
          
          expectStream(result).toBe("a-b-c|", { a: "1", b: "hello", c: "true" });
        });
      });

      it("should work with array projections", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b|", { a: [1, 2], b: [3, 4] });
          
          const result = pipe(
            source,
            switchMap(x => cold("  x|", { x: x.concat([0]) }))
          );
          
          expectStream(result).toBe("a-b|", { a: [1, 2, 0], b: [3, 4, 0] });
        });
      });

      it("should work with null and undefined values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b|", { a: null, b: undefined });
          
          const result = pipe(
            source,
            switchMap(x => cold("  x|", { x: x === null ? "null" : "undefined" }))
          );
          
          expectStream(result).toBe("a-b|", { a: "null", b: "undefined" });
        });
      });

      it("should work with boolean projections", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b|", { a: true, b: false });
          
          const result = pipe(
            source,
            switchMap(x => cold("  x-y|", { x: x, y: !x }))
          );
          
          expectStream(result).toBe("a-b-c|", { a: true, b: false, c: true });
        });
      });
    });

    describe("Index Parameter", () => {
      it("should pass correct index to projection function", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 10, b: 20, c: 30 });
          
          const result = pipe(
            source,
            switchMap((value, index) => cold("  x|", { x: value + index }))
          );
          
          expectStream(result).toBe("a-b-c|", { a: 10, b: 21, c: 32 });
        });
      });

      it("should increment index correctly", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a--b|", { a: 10, b: 20 });
          
          const result = pipe(
            source,
            switchMap((value, index) => cold("  x-y|", { x: value + index, y: (value + index) * 2 }))
          );
          
          expectStream(result).toBe("a-bc-d|", { a: 10, b: 20, c: 21, d: 42 });
        });
      });

      it("should handle index with immediate emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("(abc)|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            switchMap((value, index) => cold("  x|", { x: value * 10 + index }))
          );
          
          expectStream(result).toBe("x|", { x: 32 }); // 3 * 10 + 2
        });
      });
    });

    describe("Subscription Timing", () => {
      it("should handle late subscription", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("ab^c-d|", { a: 1, b: 2, c: 3, d: 4 });
          
          const result = pipe(
            source,
            switchMap((x: number) => cold("  x-y|", { x: x * 10, y: x * 10 + 1 }))
          );
          
          expectStream(result).toBe("a-b-c|", { a: 30, b: 40, c: 41 });
        });
      });

      it("should handle subscription during projection", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-^b-c|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            switchMap(x => cold("  x-y|", { x: x * 10, y: x * 10 + 1 }))
          );
          
          expectStream(result).toBe("a-b-c|", { a: 20, b: 30, c: 31 });
        });
      });

      it("should handle subscription after source completion", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b|^", { a: 1, b: 2 });
          
          const result = pipe(
            source,
            switchMap(x => cold("  x|", { x: x * 10 }))
          );
          
          expectStream(result).toBe("|");
        });
      });
    });
  });
});
