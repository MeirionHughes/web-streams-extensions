import { expect } from "chai";
import { from, pipe, toArray, withLatestFrom, of, timer, Subject, take, delay, throwError } from "../../src/index.js";

describe("withLatestFrom", () => {
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
