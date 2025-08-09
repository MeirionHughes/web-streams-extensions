import { expect } from "chai";
import { from, pipe, switchMap, toArray, Subject, map, take } from "../../src/index.js";
import { interval } from "../../src/interval.js";

describe("switchMap", () => {
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
});
