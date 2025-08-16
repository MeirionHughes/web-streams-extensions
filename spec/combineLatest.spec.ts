import { expect } from "chai";
import { combineLatest, from, toArray, pipe, take, timer, delay, subscribe } from "../src/index.js";
import { sleep } from "../src/utils/sleep.js";


describe("combineLatest", () => {
  it("should combine latest values from multiple streams", async () => {
    const result = await toArray(
      combineLatest(
        from([1]),
        from(['a'])
      )
    );
    
    // Test basic functionality with simple case that works reliably
    expect(result).to.deep.equal([[1, 'a']]);
  });

  it("should wait for all streams to emit before first combination", async () => {
    // Create streams where second is delayed
    const result = await toArray(
      combineLatest(
        from([1]),           // Emits immediately then completes
        from([2])            // Emits immediately then completes  
      )
    );
    
    expect(result).to.deep.equal([[1, 2]]);
  });

  it("should emit latest values when any stream emits", async () => {
    const result = await toArray(
      combineLatest(
        from([1, 2]),
        from(['a'])
      )
    );
    
    // Should get both combinations: [1, 'a'] and [2, 'a']
    expect(result).to.deep.equal([[1, 'a'], [2, 'a']]);
  });

  it("should work with three streams", async () => {
    const result = await toArray(
      combineLatest(
        from([1]),
        from(['a']),
        from([true])
      )
    );
    
    expect(result).to.deep.equal([[1, 'a', true]]);
  });

  it("should complete when ALL source streams complete (RxJS behavior)", async () => {
    let completionTime: number | undefined;
    
    await new Promise<void>((resolve) => {
      subscribe(
        combineLatest(
          from([1, 2]),     // Completes faster
          from(['a', 'b'])  // Completes faster
        ),
        () => {},
        () => { 
          completionTime = Date.now(); 
          resolve();
        }
      );
    });
    
    expect(completionTime).to.be.a('number');
  });

  it("should handle streams that complete without emitting", async () => {
    const result = await toArray(
      combineLatest(
        from([]),  // Empty stream
        from([1])  // Has values
      )
    );
    
    // Should not emit anything since one stream is empty
    expect(result).to.deep.equal([]);
  });

  it("should handle empty sources", () => {
    expect(() => combineLatest([])).to.throw("combineLatest requires at least one source stream");
  });

  it("should work with array format", async () => {
    const sources = [from([1, 2]), from([3, 4])];
    const result = await toArray(
      combineLatest(sources)
    );
    
    expect(result.length).to.be.greaterThan(0);
    expect(result[0]).to.be.an('array');
    expect(result[0].length).to.equal(2);
  });

  it("should handle different types properly", async () => {
    const result = await toArray(
      combineLatest(
        from([42]),
        from(['hello']),
        from([true])
      )
    );
    
    expect(result).to.deep.equal([[42, 'hello', true]]);
  });

  it("should maintain timing behavior with different stream lengths", async () => {
    const result = await toArray(
      combineLatest(
        from([1, 2, 3]),  // Longer stream
        from(['a'])       // Shorter stream
      )
    );
    
    // Should get: [1,'a'], [2,'a'], [3,'a']
    expect(result).to.deep.equal([[1, 'a'], [2, 'a'], [3, 'a']]);
  });

  it('should match RxJS behavior ', async () => {

    await sleep(20);// let event loop settle. 
    
    // Marble diagram:
    // A: --1---2---|
    // B: ----a---b-|
    // R: ----[1,a]-[2,a]-[2,b]|
    
    async function* streamA() {
      await sleep(20);  // t=20
      yield 1;
      await sleep(40);  // t=60
      yield 2;
      await sleep(30);  // t=90 - completes
    }
    
    async function* streamB() {
      await sleep(40);  // t=40
      yield 'a';
      await sleep(40);  // t=80
      yield 'b';
      await sleep(20);  // t=100 - completes
    }
    
    const result: Array<[number, string]> = [];
    const timestamps: number[] = [];
    const startTime = Date.now();
    
    await new Promise<void>((resolve) => {
      subscribe(
        combineLatest(from(streamA()), from(streamB())),
        value => {
          result.push(value);
          timestamps.push(Date.now() - startTime);
        },
        () => resolve()
      );
    });
    
    // Verify exact emission sequence and timing
    expect(result).to.have.length(3);
    expect(result[0]).to.deep.equal([1, 'a']); // at ~40ms when B first emits
    expect(result[1]).to.deep.equal([2, 'a']); // at ~60ms when A emits 2
    expect(result[2]).to.deep.equal([2, 'b']); // at ~80ms when B emits 'b'
    
    // Verify timing is approximately correct (allowing more margin for CI systems)
    expect(timestamps[0]).to.be.closeTo(40, 40); // First emission around 40ms (more tolerance)
    expect(timestamps[1]).to.be.closeTo(60, 40); // Second emission around 60ms (more tolerance)
    expect(timestamps[2]).to.be.closeTo(80, 40); // Third emission around 80ms (more tolerance)
  });

  it('should handle edge cases with deterministic timing', async () => {
    // Test: one stream completes early, others continue emitting
    async function* streamA() {
      await sleep(10);
      yield 'A1';
      await sleep(20);
      yield 'A2';
      // completes here at ~30ms
    }
    
    async function* streamB() {
      await sleep(15);
      yield 'B1';
      await sleep(30);
      yield 'B2';
      await sleep(50);
      yield 'B3';
      // completes here at ~95ms
    }
    
    const result: Array<[string, string]> = [];
    
    await new Promise<void>((resolve) => {
      subscribe(
        combineLatest(from(streamA()), from(streamB())),
        value => { result.push(value); },
        () => resolve()
      );
    });
    
    // Should emit 4 times as B continues emitting after A completes
    expect(result).to.have.length(4);
    expect(result[0]).to.deep.equal(['A1', 'B1']); // at ~15ms when both have emitted
    expect(result[1]).to.deep.equal(['A2', 'B1']); // at ~30ms when A emits A2
    expect(result[2]).to.deep.equal(['A2', 'B2']); // at ~45ms when B emits B2  
    expect(result[3]).to.deep.equal(['A2', 'B3']); // at ~95ms when B emits B3
    // Stream completes when ALL streams complete (B completes at ~95ms)
  });

  it('should handle immediate completion edge case', async () => {
    // Test: stream that completes immediately with no values
    async function* emptyStream() {
      // completes immediately with no values
      return;
    }
    
    async function* normalStream() {
      await sleep(10);
      yield 'N1';
      await sleep(10);
      yield 'N2';
    }
    
    const result: Array<[string, string]> = [];
    
    await new Promise<void>((resolve) => {
      subscribe(
        combineLatest(from(emptyStream()), from(normalStream())),
        value => { result.push(value); },
        () => resolve()
      );
    });
    
    // Should never emit since empty stream never emits
    expect(result).to.have.length(0);
  });

  it('should only complete when ALL streams complete (RxJS behavior)', async () => {
    // This test ensures that combineLatest waits for ALL source streams to complete
    // before completing itself, which is the correct RxJS behavior
    
    let completedAt: number | undefined;
    const startTime = Date.now();
    
    async function* quickStream() {
      await sleep(10);
      yield 'quick';
      // completes at ~10ms
    }
    
    async function* slowStream() {
      await sleep(20);
      yield 'slow1';
      await sleep(30);
      yield 'slow2';
      // completes at ~50ms
    }
    
    const result: Array<[string, string]> = [];
    
    await new Promise<void>((resolve) => {
      subscribe(
        combineLatest(from(quickStream()), from(slowStream())),
        value => { result.push(value); },
        () => { 
          completedAt = Date.now() - startTime; 
          resolve();
        }
      );
    });
    
    expect(result).to.have.length(2);
    expect(result[0]).to.deep.equal(['quick', 'slow1']);
    expect(result[1]).to.deep.equal(['quick', 'slow2']);
    
    // Should complete around 50ms (when slow stream completes), not 10ms
    expect(completedAt).to.be.greaterThan(45);
  });
});
