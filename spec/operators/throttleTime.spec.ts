import { expect } from "chai";
import { from, pipe, throttleTime, toArray, Subject, ThrottleConfig, tap } from "../../src/index.js";
import { sleep } from "../../src/utils/sleep.js";

describe("throttleTime", () => {

  describe("{ leading: true, trailing: false } - default behavior", () => {
    
    it("should emit first value immediately and ignore subsequent values until throttle period expires", async () => {
      // RxJS pattern: '-a-x-y----b---x-cx---|'
      // Expected:     '-a--------b-----c----|'
      // Throttle window: 50ms
      
      const input = [1, 2, 3, 4, 5, 6];
      let emissionTimes: number[] = [];
      const startTime = Date.now();
      
      const source = from(async function*() {
        yield input[0]; // t=0: emit 1 immediately
        await sleep(10);
        yield input[1]; // t=10: should be ignored (within throttle window)
        await sleep(10);
        yield input[2]; // t=20: should be ignored (within throttle window)
        await sleep(40); // t=60: throttle window expired
        yield input[3]; // t=60: emit 4 immediately  
        await sleep(10);
        yield input[4]; // t=70: should be ignored (within new throttle window)
        await sleep(40); // t=110: throttle window expired
        yield input[5]; // t=110: emit 6 immediately
      }());
      
      const result = await toArray(
        pipe(
          source,
          throttleTime(50), // 50ms throttle
          tap(val => emissionTimes.push(Date.now() - startTime))
        )
      );
      
      expect(result).to.deep.equal([1, 4, 6]);
      // Verify timing: first immediate (~0ms), second after throttle (~60ms), third after throttle (~110ms)
      expect(emissionTimes[0]).to.be.lessThan(20);
      expect(emissionTimes[1]).to.be.greaterThan(40);
      expect(emissionTimes[2]).to.be.greaterThan(90);
    });

    it("should handle a busy producer emitting regular sequence", async () => {
      // RxJS pattern: 'abcdefabcdefabcdefabcdefa|'
      // Expected:     'a-----a-----a-----a-----a|'
      // Throttle every 5 values with 50ms throttle
      
      const input = ['a','b','c','d','e','f','a','b','c','d','e','f','a','b','c','d','e','f','a','b','c','d','e','f','a'];
      
      const source = from(async function*() {
        for (let i = 0; i < input.length; i++) {
          yield input[i];
          await sleep(8); // Emit every 8ms, throttle window is 50ms
        }
      }());
      
      const result = await toArray(
        pipe(
          source,
          throttleTime(50)
        )
      );
      
      // Should get roughly every 6th-7th value (50ms / 8ms ≈ 6.25)
      expect(result.length).to.be.greaterThan(3);
      expect(result.length).to.be.lessThan(8);
      expect(result[0]).to.equal('a'); // First value always emitted
    });

    it("should mirror source if values are not emitted often enough", async () => {
      // RxJS pattern: '-a--------b-----c----|'
      // Expected:     '-a--------b-----c----|'
      // All values outside throttle window
      
      const input = [1, 2, 3];
      
      const source = from(async function*() {
        yield input[0];
        await sleep(100); // Well beyond throttle window
        yield input[1];
        await sleep(80);  // Beyond throttle window
        yield input[2];
      }());
      
      const result = await toArray(
        pipe(
          source,
          throttleTime(50)
        )
      );
      
      expect(result).to.deep.equal([1, 2, 3]);
    });

    it("should handle empty stream", async () => {
      const result = await toArray(
        pipe(
          from([]),
          throttleTime(50)
        )
      );
      
      expect(result).to.deep.equal([]);
    });

    it("should handle single value", async () => {
      const result = await toArray(
        pipe(
          from([42]),
          throttleTime(50)
        )
      );
      
      expect(result).to.deep.equal([42]);
    });
  });

  describe("{ leading: true, trailing: true }", () => {
    
    it("should emit first and last values in each time window", async () => {
      // RxJS pattern: '-a-xy-----b--x--cxxx--|'
      // Expected:     '-a---y----b---x---x---(x|)'
      // Leading emits immediately, trailing emits last value after throttle
      
      const input = [1, 2, 3, 4, 5, 6, 7];
      
      const source = from(async function*() {
        yield input[0]; // t=0: emit 1 immediately (leading)
        await sleep(10);
        yield input[1]; // t=10: queued for trailing
        await sleep(10);
        yield input[2]; // t=20: overwrites trailing queue (only last counts)
        await sleep(50); // t=70: emit 3 as trailing, start new window (increased gap)
        yield input[3]; // t=70: emit 4 immediately (leading)
        await sleep(10);
        yield input[4]; // t=80: queued for trailing
        await sleep(50); // t=130: emit 5 as trailing, start new window (increased gap)
        yield input[5]; // t=130: emit 6 immediately (leading)
        await sleep(10);
        yield input[6]; // t=140: queued for trailing, will emit on completion
      }());
      
      const result = await toArray(
        pipe(
          source,
          throttleTime(50, { leading: true, trailing: true })
        )
      );
      
      expect(result).to.deep.equal([1, 3, 4, 5, 6, 7]);
    });

    it("should emit single value if only one is given", async () => {
      const result = await toArray(
        pipe(
          from([42]),
          throttleTime(50, { leading: true, trailing: true })
        )
      );
      
      expect(result).to.deep.equal([42]);
    });

    it("should handle rapid emissions with trailing on completion", async () => {
      const subject = new Subject<number>();
      
      const resultPromise = toArray(
        pipe(
          subject.readable,
          throttleTime(50, { leading: true, trailing: true })
        )
      );
      
      // Emit leading value
      await subject.next(1);
      await sleep(10);
      await subject.next(2); // Will be trailing
      await sleep(10);
      await subject.next(3); // Overwrites trailing
      
      // Complete before throttle window expires
      await subject.complete();
      
      const result = await resultPromise;
      expect(result).to.deep.equal([1, 3]); // Leading + trailing
    });
  });

  describe("{ leading: false, trailing: true }", () => {
    
    it("should emit only the last value in each time window", async () => {
      // RxJS pattern: '-a-xy-----b--x--cxxx--|'
      // Expected:     '-----y--------x---x---(x|)'
      // No leading emission, only trailing after throttle window
      
      const input = [1, 2, 3, 4, 5, 6, 7];
      
      const source = from(async function*() {
        yield input[0]; // t=0: queued for trailing
        await sleep(10);
        yield input[1]; // t=10: overwrites trailing queue
        await sleep(10);
        yield input[2]; // t=20: overwrites trailing queue
        await sleep(50); // t=70: emit 3 as trailing (increased gap for browser timing)
        yield input[3]; // t=70: queued for trailing
        await sleep(10);
        yield input[4]; // t=80: overwrites trailing queue
        await sleep(50); // t=130: emit 5 as trailing (increased gap for browser timing)
        yield input[5]; // t=130: queued for trailing
        await sleep(10);
        yield input[6]; // t=140: overwrites trailing queue, will emit on completion
      }());
      
      const result = await toArray(
        pipe(
          source,
          throttleTime(50, { leading: false, trailing: true })
        )
      );
      
      expect(result).to.deep.equal([3, 5, 7]);
    });

    it("should wait for trailing throttle before completing", async () => {
      const subject = new Subject<number>();
      
      const resultPromise = toArray(
        pipe(
          subject.readable,
          throttleTime(50, { leading: false, trailing: true })
        )
      );
      
      await subject.next(1);
      await sleep(10);
      await subject.next(2); // This will be the trailing value
      
      // Complete immediately - should wait for throttle before emitting trailing
      await subject.complete();
      
      const result = await resultPromise;
      expect(result).to.deep.equal([2]);
    });

    it("should emit single value after throttle period", async () => {
      const result = await toArray(
        pipe(
          from([42]),
          throttleTime(50, { leading: false, trailing: true })
        )
      );
      
      expect(result).to.deep.equal([42]);
    });

    it("should handle multiple values with delayed completion", async () => {
      const subject = new Subject<number>();
      
      const resultPromise = toArray(
        pipe(
          subject.readable,
          throttleTime(30, { leading: false, trailing: true })
        )
      );
      
      // First batch
      await subject.next(1);
      await subject.next(2);
      await subject.next(3); // Will be first trailing
      
      await sleep(40); // Wait for throttle to expire and emit
      
      // Second batch
      await subject.next(4);
      await subject.next(5); // Will be second trailing
      
      await sleep(40); // Wait for throttle to expire
      
      await subject.complete();
      
      const result = await resultPromise;
      expect(result).to.deep.equal([3, 5]);
    });
  });

  describe("{ leading: false, trailing: false }", () => {
    
    it("should emit nothing for any input", async () => {
      // With both leading and trailing false, no values should be emitted
      const input = [1, 2, 3, 4, 5];
      
      const source = from(async function*() {
        for (const value of input) {
          yield value;
          await sleep(10);
        }
      }());
      
      const result = await toArray(
        pipe(
          source,
          throttleTime(50, { leading: false, trailing: false })
        )
      );
      
      expect(result).to.deep.equal([]);
    });

    it("should emit nothing for single value", async () => {
      const result = await toArray(
        pipe(
          from([42]),
          throttleTime(50, { leading: false, trailing: false })
        )
      );
      
      expect(result).to.deep.equal([]);
    });

    it("should emit nothing for empty stream", async () => {
      const result = await toArray(
        pipe(
          from([]),
          throttleTime(50, { leading: false, trailing: false })
        )
      );
      
      expect(result).to.deep.equal([]);
    });

    it("should emit nothing even with long delays between values", async () => {
      const source = from(async function*() {
        yield 1;
        await sleep(100); // Well beyond throttle window
        yield 2;
        await sleep(100);
        yield 3;
      }());
      
      const result = await toArray(
        pipe(
          source,
          throttleTime(50, { leading: false, trailing: false })
        )
      );
      
      expect(result).to.deep.equal([]);
    });
  });

  describe("edge cases and error handling", () => {
    
    it("should handle zero throttle duration", async () => {
      const result = await toArray(
        pipe(
          from([1, 2, 3]),
          throttleTime(0)
        )
      );
      
      // With zero throttle, should emit all values
      expect(result).to.deep.equal([1, 2, 3]);
    });

    it("should throw error for negative throttle duration", () => {
      expect(() => throttleTime(-1)).to.throw();
    });

    it("should handle stream errors", async () => {
      const errorStream = new ReadableStream({
        start(controller) {
          controller.enqueue(1);
          controller.error(new Error("Stream error"));
        }
      });

      try {
        await toArray(
          pipe(
            errorStream,
            throttleTime(50)
          )
        );
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err.message).to.equal("Stream error");
      }
    });

    it("should handle cancellation properly", async () => {
      const subject = new Subject<number>();
      
      const stream = pipe(
        subject.readable,
        throttleTime(100)
      );
      
      const reader = stream.getReader();
      
      await subject.next(1);
      await subject.next(2);
      
      // Cancel before throttle period expires
      await reader.cancel("Test cancellation");
      reader.releaseLock();
      
      await subject.complete();
    });

    it("should handle very short throttle times", async () => {
      const result = await toArray(
        pipe(
          from([1, 2, 3]),
          throttleTime(1)
        )
      );
      
      // Should still throttle effectively
      expect(result.length).to.be.greaterThan(0);
      expect(result[0]).to.equal(1); // First value always emitted in leading mode
    });

    it("should handle concurrent reads properly", async () => {
      const subject = new Subject<number>();
      
      const throttled = pipe(
        subject.readable,
        throttleTime(50, { leading: true, trailing: true })
      );
      
      const reader = throttled.getReader();
      
      // Rapid succession
      await subject.next(1);
      await subject.next(2);
      await subject.next(3);
      
      const first = await reader.read();
      expect(first.value).to.equal(1); // Leading value
      
      await subject.complete();
      
      const second = await reader.read();
      expect(second.value).to.equal(3); // Trailing value
      
      const end = await reader.read();
      expect(end.done).to.be.true;
      
      reader.releaseLock();
    });
  });

  describe("timing verification", () => {
    
    it("should respect throttle timing accurately", async () => {
      const emissions: { value: number; time: number }[] = [];
      const startTime = Date.now();
      
      const source = from(async function*() {
        for (let i = 1; i <= 10; i++) {
          yield i;
          await sleep(20); // Emit every 20ms
        }
      }());
      
      await toArray(
        pipe(
          source,
          throttleTime(60), // Throttle for 60ms
          tap(value => emissions.push({ value, time: Date.now() - startTime }))
        )
      );
      
      // Should get roughly 3-4 emissions (200ms total / 60ms throttle)
      expect(emissions.length).to.be.greaterThan(2);
      expect(emissions.length).to.be.lessThan(6);
      
      // Verify timing between emissions
      for (let i = 1; i < emissions.length; i++) {
        const timeDiff = emissions[i].time - emissions[i-1].time;
        expect(timeDiff).to.be.greaterThan(50); // Should be at least throttle duration
      }
    });
  });
});
