import { describe, it } from "mocha";
import { expect } from "chai";
import { from, pipe, toArray, exhaustMap, timer, Subject, interval, skip, exhaustAll, mapSync, take } from "../../src/index.js";
import { sleep } from "../../src/utils/sleep.js";

describe("exhaustMap", () => {
  it("should ignore new inner streams while current is active", async () => {
      
      const resultPromise = toArray(
        pipe(
          from(async function *(){            
              yield pipe(interval(10),skip(1), take(3), mapSync(x=>x)), 
              await sleep(30); 
              yield pipe(interval(10),skip(1), take(3), mapSync(x=>x*10)), 
              await sleep(30); 
              yield pipe(interval(10),skip(1), take(3), mapSync(x=>x*100))
          }),
          exhaustMap(x=>pipe(x, mapSync(x=>x.toString())))
        )
      );
      const result = await resultPromise;
      expect(result).to.deep.equal(["1", "2", "3", "100", "200", "300"]);
    });

  it("should work with arrays", async () => {
    const result = await toArray(pipe(
      from([1, 2, 3]),
      exhaustMap(n => [n])
    ));
    expect(result[0]).to.equal(1);
  });

  it("should work with promises", async () => {
    const result = await toArray(pipe(
      from([1, 2]),
      exhaustMap(n => Promise.resolve(n * 2))
    ));
    // With exhaust semantics, only first value should be processed
    expect(result).to.deep.equal([2]);
  });

  it("should handle empty source stream", async () => {
    const result = await toArray(pipe(
      from([]),
      exhaustMap(n => [n])
    ));
    expect(result).to.deep.equal([]);
  });

  it("should handle stream errors", async () => {
    const source = new Subject<number>();
    const errorMessage = "test error";
    
    const streamPromise = toArray(pipe(
      source.readable,
      exhaustMap(n => [n])
    ));

    source.error(new Error(errorMessage));

    try {
      await streamPromise;
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.equal(errorMessage);
    }
  });

  it("should handle errors in projection function", async () => {
    const errorMessage = "projection error";
    
    try {
      await toArray(pipe(
        from([1]),
        exhaustMap(() => {
          throw new Error(errorMessage);
        })
      ));
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.equal(errorMessage);
    }
  });

  it("should handle cancellation properly", async () => {
    const source = new Subject<number>();
    let cancelled = false;
    
    const stream = pipe(
      source.readable,
      exhaustMap(n => from([n]))
    );
    
    const reader = stream.getReader();
    
    // Start reading
    const readPromise = reader.read();
    
    // Cancel immediately
    reader.cancel("test cancel").then(() => {
      cancelled = true;
    });
    
    source.next(1);
    
    const result = await readPromise;
    expect(result.done).to.be.true;
    
    // Allow some time for cleanup
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(cancelled).to.be.true;
  });

  it("should handle cancellation while processing inner stream", async () => {
    const source = new Subject<number>();
    let cancelled = false;
    
    const stream = pipe(
      source.readable,
      exhaustMap(n => from([n, n * 10, n * 100])) // Longer inner stream
    );
    
    const reader = stream.getReader();
    
    // Start reading to initiate inner stream processing
    source.next(1);
    
    // Read first value
    const firstResult = await reader.read();
    expect(firstResult.value).to.equal(1);
    
    // Cancel while inner stream is still active
    reader.cancel("test cancel").then(() => {
      cancelled = true;
    });
    
    // Allow some time for cleanup
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(cancelled).to.be.true;
  });

  it("should work with custom highWaterMark", async () => {
    const source = from([1, 2, 3]);
    const result = await toArray(
      exhaustMap(n => [n])(source, { highWaterMark: 1 })
    );
    expect(result[0]).to.equal(1);
  });

  it("should handle inner stream completion before new source values", async () => {
    // Use a controlled subject to emit values at specific times
    const source = new Subject<number>();
    
    let innerStreamCount = 0;
    const streamPromise = toArray(pipe(
      source.readable,
      exhaustMap(n => {
        innerStreamCount++;
        return from([n, n * 10]);
      })
    ));

    // Emit first value
    source.next(1);
    
    // Wait for processing to complete
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Emit second value after first inner stream completes
    source.next(2);
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Complete the source
    source.complete();

    const result = await streamPromise;
    
    // Should have processed both values since they didn't overlap
    expect(innerStreamCount).to.equal(2);
    expect(result).to.include.members([1, 10, 2, 20]);
  });

  it("should work with rapidly emitted values", async () => {
    // Test with synchronous array source - only first value should be processed with exhaust semantics
    const result = await toArray(pipe(
      from([1, 2, 3]),
      exhaustMap(n => [n * 10])
    ));
    
    // With exhaust semantics, only first value should be processed
    expect(result).to.deep.equal([10]);
  });

  it("should handle single value streams", async () => {
    const result = await toArray(pipe(
      from([42]),
      exhaustMap(n => [n * 2])
    ));
    expect(result).to.deep.equal([84]);
  });

  it("should pass index to projection function", async () => {
    let indices = [];
    
    await toArray(pipe(
      from([10, 20]),
      exhaustMap((n, index) => {
        indices.push(index);
        return [index];
      })
    ));
    
    // With exhaust semantics, only first value should be processed
    expect(indices).to.deep.equal([0]);
  });
});
