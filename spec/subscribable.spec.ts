import { expect } from "chai";
import { toArray, pipe, map, take, toPromise, from } from '../src/index.js';
import { Subject } from "../src/subjects/subject.js";
import { Subscribable } from "../src/_subscribable.js";

describe("subscribable", () => {
  it("disposing a subscriber doesn't end the whole subscribable ", async () => {
    let expected1 = [1, 2];
    let expected2 = [1, 2, 3, 4];
    let result1 = [];
    let result2 = [];

    let subscribable = new Subscribable<number>();

    let sub1 = subscribable.subscribe({
      next: (value: number) => { result1.push(value); return 1 },
      complete: () => { },
      error: () => { }
    });

    let sub2 = subscribable.subscribe({
      next: (value: number) => {  result2.push(value);  return 1 },
      complete: () => { },
      error: () => { }
    });

    await subscribable.next(1);
    await subscribable.next(2);

    sub1.unsubscribe();

    await subscribable.next(3);
    await subscribable.next(4);
    await subscribable.complete();

    expect(result1, "from stream result matches expected").to.be.deep.eq(expected1);    
    expect(result2, "from stream result matches expected").to.be.deep.eq(expected2);

    expect(sub1.closed, "sub1 is closed").to.be.eq(true);
    expect(sub2.closed, "sub2 is closed").to.be.eq(true);
  })

  it("should handle subscription to already closed subscribable", async () => {
    let completeCalled = false;
    
    let subscribable = new Subscribable<number>();
    subscribable.complete(); // Close first
    
    let sub = subscribable.subscribe({
      next: (value: number) => { return 1 },
      complete: () => { completeCalled = true },
      error: () => { }
    });

    expect(sub.closed).to.be.true;
    expect(completeCalled).to.be.true;
  });

  it("should handle error in subscriber next callback", async () => {
    let subscribable = new Subscribable<number>();
    let errorHandled = false;

    let sub = subscribable.subscribe({
      next: (value: number) => { 
        if (value === 2) {
          throw new Error("Subscriber error");
        }
        return 1;
      },
      complete: () => { },
      error: (err) => { 
        errorHandled = true;
        expect(err.message).to.equal("Subscriber error");
      }
    });

    subscribable.next(1); // Should work
    subscribable.next(2); // Should trigger error

    expect(errorHandled).to.be.true;
  });

  it("should handle error in subscriber error callback", async () => {
    let subscribable = new Subscribable<number>();

    let sub = subscribable.subscribe({
      next: (value: number) => { 
        throw new Error("Next error");
      },
      complete: () => { },
      error: (err) => { 
        throw new Error("Error handler error"); // This should be ignored
      }
    });

    // This should not throw even though error handler throws
    subscribable.next(1);
  });

  it("should handle backpressure with multiple subscribers", async () => {
    let subscribable = new Subscribable<number>();

    let sub1 = subscribable.subscribe({
      next: (value: number) => { return 5 }, // Higher backpressure
      complete: () => { },
      error: () => { }
    });

    let sub2 = subscribable.subscribe({
      next: (value: number) => { return 2 }, // Lower backpressure
      complete: () => { },
      error: () => { }
    });

    let result = subscribable.next(1);
    
    // Should return minimum desired size
    expect(result).to.equal(2);
  });

  it("should return 0 for next when closed", async () => {
    let subscribable = new Subscribable<number>();
    
    subscribable.complete(); // Close it
    
    let result = subscribable.next(1);
    expect(result).to.equal(0);
  });

  it("should return 0 for next when no subscribers", async () => {
    let subscribable = new Subscribable<number>();
    
    let result = subscribable.next(1);
    expect(result).to.equal(0);
  });

  it("should handle complete when already closed", async () => {
    let subscribable = new Subscribable<number>();
    
    subscribable.complete(); // Close first time
    subscribable.complete(); // Should handle second call gracefully
    
    expect(subscribable.closed).to.be.true;
  });

  it("should handle error when already closed", async () => {
    let subscribable = new Subscribable<number>();
    
    subscribable.complete(); // Close first
    subscribable.error(new Error("Test error")); // Should handle gracefully
    
    expect(subscribable.closed).to.be.true;
  });

  it("should handle errors in complete callbacks", async () => {
    let subscribable = new Subscribable<number>();
    let completeCount = 0;

    let sub1 = subscribable.subscribe({
      next: (value: number) => { return 1 },
      complete: () => { 
        completeCount++;
        throw new Error("Complete error"); // Should be ignored
      },
      error: () => { }
    });

    let sub2 = subscribable.subscribe({
      next: (value: number) => { return 1 },
      complete: () => { 
        completeCount++;
      },
      error: () => { }
    });

    subscribable.complete();

    expect(completeCount).to.equal(2);
    expect(subscribable.closed).to.be.true;
    expect(subscribable.subscribers.length).to.equal(0);
  });

  it("should handle errors in error callbacks", async () => {
    let subscribable = new Subscribable<number>();
    let errorCount = 0;

    let sub1 = subscribable.subscribe({
      next: (value: number) => { return 1 },
      complete: () => { },
      error: (err) => { 
        errorCount++;
        throw new Error("Error handler error"); // Should be ignored
      }
    });

    let sub2 = subscribable.subscribe({
      next: (value: number) => { return 1 },
      complete: () => { },
      error: (err) => { 
        errorCount++;
      }
    });

    subscribable.error(new Error("Test error"));

    expect(errorCount).to.equal(2);
    expect(subscribable.closed).to.be.true;
    expect(subscribable.subscribers.length).to.equal(0);
  });

  it("should handle unsubscribe of non-existent subscriber", async () => {
    let subscribable = new Subscribable<number>();

    let sub = subscribable.subscribe({
      next: (value: number) => { return 1 },
      complete: () => { },
      error: () => { }
    });

    // Unsubscribe twice
    sub.unsubscribe();
    sub.unsubscribe(); // Should handle gracefully

    expect(sub.closed).to.be.true;
    expect(subscribable.subscribers.length).to.equal(0);
  });
})
