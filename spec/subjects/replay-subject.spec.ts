import { expect } from "chai";
import { ReplaySubject } from "../../src/subjects/replay-subject.js";
import {  map, pipe, take, toArray, toPromise, from } from "../../src/index.js";


describe("ReplaySubject", function () {
  describe("Basic functionality", function () {
    it("should replay values to new subscribers", async function () {
      const subject = new ReplaySubject<number>();
      
      // Emit some values
      await subject.next(1);
      await subject.next(2);
      await subject.next(3);
      
      // New subscriber should receive all values
      const result = await toArray(pipe(subject.readable, take(3)));
      expect(result).to.deep.equal([1, 2, 3]);
    });

    it("should emit values to existing subscribers and replay to new ones", async function () {
      const subject = new ReplaySubject<number>();
      
      // Start collecting values from existing subscriber
      const existingSubscriberPromise = toArray(pipe(subject.readable, take(4)));
      
      // Emit some values
      await subject.next(1);
      await subject.next(2);
      
      // New subscriber should get replayed values plus new ones
      const newSubscriberPromise = toArray(pipe(subject.readable, take(4)));
      
      await subject.next(3);
      await subject.next(4);
      
      const existingResult = await existingSubscriberPromise;
      const newResult = await newSubscriberPromise;
      
      expect(existingResult).to.deep.equal([1, 2, 3, 4]);
      expect(newResult).to.deep.equal([1, 2, 3, 4]); // Replayed 1,2 then got 3,4
    });

    it("should handle completion correctly", async function () {
      const subject = new ReplaySubject<number>();
      
      await subject.next(1);
      await subject.next(2);
      await subject.complete();
      
      // New subscriber should get replayed values and completion
      const result = await toArray(subject.readable);
      expect(result).to.deep.equal([1, 2]);
    });

    it("should handle errors correctly", async function () {
      const subject = new ReplaySubject<number>();
      
      await subject.next(1);
      await subject.next(2);
      await subject.error("test error");
      
      // New subscriber should get replayed values and then error
      let values: number[] = [];
      let errorCaught: any = null;
      
      try {
        // Use subscribe to capture values before error
        subject.subscribe({
          next: (value) => values.push(value),
          error: (err) => { errorCaught = err; },
          complete: () => {}
        });
      } catch (error) {
        errorCaught = error;
      }
      
      // Give time for synchronous replay
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(values).to.deep.equal([1, 2]);
      expect(errorCaught).to.equal("test error");
    });
  });

  describe("Buffer size constraints", function () {
    it("should respect buffer size limit", async function () {
      const subject = new ReplaySubject<number>(2); // Buffer size of 2
      
      await subject.next(1);
      await subject.next(2);
      await subject.next(3);
      await subject.next(4);
      
      // New subscriber should only get last 2 values
      const result = await toArray(pipe(subject.readable, take(2)));
      expect(result).to.deep.equal([3, 4]);
    });

    it("should handle buffer size of 1", async function () {
      const subject = new ReplaySubject<number>(1);
      
      await subject.next(1);
      await subject.next(2);
      await subject.next(3);
      
      // New subscriber should only get last value
      const result = await toArray(pipe(subject.readable, take(1)));
      expect(result).to.deep.equal([3]);
    });

    it("should handle buffer size of 0", async function () {
      const subject = new ReplaySubject<number>(0);
      
      await subject.next(1);
      await subject.next(2);
      
      // New subscriber should get no replayed values
      const subscriptionPromise = toArray(pipe(subject.readable, take(1)));
      
      // Emit a new value after subscription
      await subject.next(3);
      
      const result = await subscriptionPromise;
      expect(result).to.deep.equal([3]); // Only the new value
    });

    it("should handle infinite buffer size", async function () {
      const subject = new ReplaySubject<number>(Infinity);
      
      // Emit many values
      for (let i = 1; i <= 100; i++) {
        await subject.next(i);
      }
      
      // New subscriber should get all values
      const result = await toArray(pipe(subject.readable, take(100)));
      const expected = Array.from({ length: 100 }, (_, i) => i + 1);
      expect(result).to.deep.equal(expected);
    });
  });

  describe("Window time constraints", function () {
    it("should respect window time limit", async function () {
      let currentTime = 1000;
      const mockTimeProvider = () => currentTime;
      const subject = new ReplaySubject<number>(Infinity, 500, mockTimeProvider); // 500ms window
      
      currentTime = 1000;
      await subject.next(1);
      
      currentTime = 1200;
      await subject.next(2);
      
      currentTime = 1600; // 600ms from first value, 400ms from second
      await subject.next(3);
      
      // New subscriber should only get values within window time (500ms)
      const result = await toArray(pipe(subject.readable, take(2)));
      expect(result).to.deep.equal([2, 3]); // Value 1 is outside window
    });

    it("should handle very short window time", async function () {
      let currentTime = 1000;
      const mockTimeProvider = () => currentTime;
      const subject = new ReplaySubject<number>(Infinity, 1, mockTimeProvider); // 1ms window
      
      currentTime = 1000;
      await subject.next(1);
      
      currentTime = 1001; // 1ms later, but still within window (< means within window)
      await subject.next(2);
      
      currentTime = 1003; // 3ms from first value, outside window, 2ms from second value, outside window
      
      // New subscriber should get no replayed values due to expired window
      const subscriptionPromise = toArray(pipe(subject.readable, take(1)));
      
      await subject.next(3);
      
      const result = await subscriptionPromise;
      expect(result).to.deep.equal([3]); // Only new value
    });

    it("should handle infinite window time", async function () {
      let currentTime = 1000;
      const mockTimeProvider = () => currentTime;
      const subject = new ReplaySubject<number>(Infinity, Infinity, mockTimeProvider);
      
      currentTime = 1000;
      await subject.next(1);
      
      currentTime = 10000; // Much later
      await subject.next(2);
      
      // Should still replay all values regardless of time
      const result = await toArray(pipe(subject.readable, take(2)));
      expect(result).to.deep.equal([1, 2]);
    });
  });

  describe("Combined buffer size and window time", function () {
    it("should respect both buffer size and window time constraints", async function () {
      let currentTime = 1000;
      const mockTimeProvider = () => currentTime;
      const subject = new ReplaySubject<number>(3, 500, mockTimeProvider); // Buffer 3, window 500ms
      
      currentTime = 1000;
      await subject.next(1);
      
      currentTime = 1100;
      await subject.next(2);
      
      currentTime = 1200;
      await subject.next(3);
      
      currentTime = 1300;
      await subject.next(4); // This should push out value 1 due to buffer size
      
      currentTime = 1600; // 600ms from value 1, should be outside window anyway
      
      // Should get values 2, 3, 4 (buffer size constraint) 
      // but value 1 would be outside window time anyway
      const result = await toArray(pipe(subject.readable, take(3)));
      expect(result).to.deep.equal([2, 3, 4]);
    });

    it("should prioritize window time over buffer size when window is more restrictive", async function () {
      let currentTime = 1000;
      const mockTimeProvider = () => currentTime;
      const subject = new ReplaySubject<number>(5, 200, mockTimeProvider); // Buffer 5, window 200ms
      
      currentTime = 1000;
      await subject.next(1);
      
      currentTime = 1100;
      await subject.next(2);
      
      currentTime = 1300; // Value 1 is now 300ms old, outside 200ms window
      await subject.next(3);
      
      // Should only get values 2, 3 due to window time constraint
      const result = await toArray(pipe(subject.readable, take(2)));
      expect(result).to.deep.equal([2, 3]);
    });
  });

  describe("Edge cases", function () {
    it("should handle empty buffer", async function () {
      const subject = new ReplaySubject<number>();
      
      // Subscribe before any values are emitted
      const subscriptionPromise = toArray(pipe(subject.readable, take(1)));
      
      await subject.next(1);
      
      const result = await subscriptionPromise;
      expect(result).to.deep.equal([1]);
    });

    it("should handle multiple simultaneous subscriptions", async function () {
      const subject = new ReplaySubject<number>();
      
      await subject.next(1);
      await subject.next(2);
      
      // Multiple simultaneous subscriptions
      const results = await Promise.all([
        toArray(pipe(subject.readable, take(2))),
        toArray(pipe(subject.readable, take(2))),
        toArray(pipe(subject.readable, take(2)))
      ]);
      
      results.forEach(result => {
        expect(result).to.deep.equal([1, 2]);
      });
    });

    it("should work with different value types", async function () {
      const subject = new ReplaySubject<string>();
      
      await subject.next("hello");
      await subject.next("world");
      
      const result = await toArray(pipe(subject.readable, take(2)));
      expect(result).to.deep.equal(["hello", "world"]);
    });

    it("should work with object values", async function () {
      const subject = new ReplaySubject<{ id: number; name: string }>();
      
      const obj1 = { id: 1, name: "test1" };
      const obj2 = { id: 2, name: "test2" };
      
      await subject.next(obj1);
      await subject.next(obj2);
      
      const result = await toArray(pipe(subject.readable, take(2)));
      expect(result).to.deep.equal([obj1, obj2]);
    });

    it("should handle rapid emissions", async function () {
      const subject = new ReplaySubject<number>(1000);
      
      // Emit many values rapidly
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(subject.next(i));
      }
      await Promise.all(promises);
      
      // New subscriber should get all values
      const result = await toArray(pipe(subject.readable, take(100)));
      const expected = Array.from({ length: 100 }, (_, i) => i);
      expect(result).to.deep.equal(expected);
    });

    it("should maintain FIFO order in buffer", async function () {
      const subject = new ReplaySubject<number>(3);
      
      // Fill buffer beyond capacity
      await subject.next(1);
      await subject.next(2);
      await subject.next(3);
      await subject.next(4);
      await subject.next(5);
      
      // Should get last 3 values in correct order
      const result = await toArray(pipe(subject.readable, take(3)));
      expect(result).to.deep.equal([3, 4, 5]);
    });
  });

  describe("Integration with existing Subject functionality", function () {
    it("should work with pipeTo", async function () {
      const subject = new ReplaySubject<number>();
      
      await subject.next(1);
      await subject.next(2);
      
      const resultPromise = toArray(subject.readable);
      
      // Pipe new values
      from([3, 4]).pipeTo(subject.writable);
      
      const result = await resultPromise;
      expect(result).to.deep.equal([1, 2, 3, 4]);
    });

    it("should work with pipeThrough", async function () {
      const subject = new ReplaySubject<number>();
      
      await subject.next(1);
      await subject.next(2);
      
      const result = await toArray(from([3, 4]).pipeThrough(subject));
      expect(result).to.deep.equal([1, 2, 3, 4]);
    });

    it("should work with operators", async function () {
      const subject = new ReplaySubject<number>();
      
      await subject.next(1);
      await subject.next(2);
      await subject.next(3);
      
      const result = await toArray(
        pipe(
          subject.readable,
          map(x => x * 2),
          take(3)
        )
      );
      expect(result).to.deep.equal([2, 4, 6]);
    });
  });

  describe("Property getters", function () {
    it("should return correct buffer size", function () {
      const subject = new ReplaySubject<number>(5);
      expect(subject.bufferSize).to.equal(0);
      
      subject.next(1);
      expect(subject.bufferSize).to.equal(1);
      
      subject.next(2);
      expect(subject.bufferSize).to.equal(2);
    });

    it("should return correct max buffer size", function () {
      const subject = new ReplaySubject<number>(5);
      expect(subject.maxBufferSize).to.equal(5);
    });

    it("should return correct window time", function () {
      const subject = new ReplaySubject<number>(Infinity, 1000);
      expect(subject.windowTime).to.equal(1000);
    });

    it("should handle buffer size overflow", async function () {
      const subject = new ReplaySubject<number>(3);
      
      await subject.next(1);
      await subject.next(2);
      await subject.next(3);
      expect(subject.bufferSize).to.equal(3);
      
      await subject.next(4);
      expect(subject.bufferSize).to.equal(3); // Should not exceed max
    });
  });

  describe("Differences with BehaviorSubject", function () {
    it("should replay values even after error (unlike BehaviorSubject)", async function () {
      const subject = new ReplaySubject<number>();
      
      await subject.next(1);
      await subject.next(2);
      await subject.error("test error");
      
      // New subscriber should still get replayed values before error
      let values: number[] = [];
      let errorCaught: any = null;
      
      subject.subscribe({
        next: (value) => values.push(value),
        error: (err) => { errorCaught = err; },
        complete: () => {}
      });
      
      // Give time for synchronous replay
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // ReplaySubject should buffer and replay values even after error
      expect(values).to.deep.equal([1, 2]);
      expect(errorCaught).to.equal("test error");
    });

    it("should not require initial value (unlike BehaviorSubject)", async function () {
      const subject = new ReplaySubject<number>();
      
      // Should be able to create without initial value
      expect(subject.bufferSize).to.equal(0);
      
      // Subscribe before any values - should wait for first value
      const subscriptionPromise = toArray(pipe(subject.readable, take(1)));
      
      await subject.next(42);
      
      const result = await subscriptionPromise;
      expect(result).to.deep.equal([42]);
    });
  });
});
