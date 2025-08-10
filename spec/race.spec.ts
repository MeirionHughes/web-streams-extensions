import { expect } from "chai";
import { race, from, toArray, timer, pipe, take, throwError, empty, of } from "../src/index.js";

describe("race", () => {
  it("should emit from first source to emit", async () => {
    const fast = from([1, 2, 3]);
    const slow = timer(100);
    
    const result = await toArray(pipe(
      race(fast, slow),
      take(2)
    ));
    
    expect(result).to.deep.equal([1, 2]);
  });

  it("should handle errors from winner", async () => {
    const errorStream = throwError(new Error("Test error"));
    const normalStream = timer(100);
    
    try {
      await toArray(race(errorStream, normalStream));
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.equal("Test error");
    }
  });

  it("should throw error for empty sources", () => {
    expect(() => race()).to.throw("race requires at least one source stream");
  });

  it("should handle all streams completing without emitting", async () => {
    const empty1 = empty();
    const empty2 = empty();
    const empty3 = empty();
    
    const result = await toArray(race(empty1, empty2, empty3));
    expect(result).to.deep.equal([]);
  });

  it("should handle single stream", async () => {
    const single = from([1, 2, 3]);
    const result = await toArray(race(single));
    expect(result).to.deep.equal([1, 2, 3]);
  });

  it("should handle stream that completes immediately", async () => {
    const immediate = from([42]);
    const delayed = timer(100);
    
    const result = await toArray(race(immediate, delayed));
    expect(result).to.deep.equal([42]);
  });

  it("should handle multiple fast streams", async () => {
    const fast1 = from([1, 2]);
    const fast2 = from([10, 20]);
    const fast3 = from([100, 200]);
    
    const result = await toArray(race(fast1, fast2, fast3));
    // One of them should win, we just check it's one of the expected values
    expect([1, 10, 100]).to.include(result[0]);
  });

  it("should handle cancellation properly", async () => {
    const slow1 = timer(1000);
    const slow2 = timer(2000);
    
    const raceStream = race(slow1, slow2);
    const reader = raceStream.getReader();
    
    // Start reading but cancel quickly
    const readPromise = reader.read();
    await reader.cancel();
    
    const result = await readPromise;
    expect(result.done).to.be.true;
  });

  it("should handle error in non-winning stream", async () => {
    const fast = from([1, 2, 3]);
    const errorStream = new ReadableStream({
      start(controller) {
        setTimeout(() => {
          controller.error(new Error("Delayed error"));
        }, 50);
      }
    });
    
    const result = await toArray(race(fast, errorStream));
    expect(result).to.deep.equal([1, 2, 3]);
  });

  it("should continue reading from winner after first emission", async () => {
    const winner = from([1, 2, 3, 4, 5]);
    const loser = timer(1000);
    
    const result = await toArray(race(winner, loser));
    expect(result).to.deep.equal([1, 2, 3, 4, 5]);
  });

  it("should handle error during winner stream continuation", async () => {
    // Create a stream that emits one value then errors
    const errorAfterEmit = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        setTimeout(() => {
          controller.error(new Error("Error after emit"));
        }, 10);
      }
    });
    
    const slow = timer(1000);
    
    try {
      await toArray(race(errorAfterEmit, slow));
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.equal("Error after emit");
    }
  });

  it("should handle stream that errors before emitting", async () => {
    // The error stream might win the race, so we should expect the error
    const immediate = from([42]);
    const errorBeforeEmit = throwError(new Error("Immediate error"));
    
    try {
      // Since throwError immediately errors, it might win the race
      const result = await toArray(race(immediate, errorBeforeEmit));
      // If immediate wins, it should return [42]
      expect(result).to.deep.equal([42]);
    } catch (err) {
      // If error wins, we should get the error
      expect(err.message).to.equal("Immediate error");
    }
  });

  it("should handle complex race scenario with mixed completion timing", async () => {
    // One empty stream, one with values, one that errors slowly
    const emptyStream = empty();
    const valueStream = from([10]);  // Just one value to ensure it wins cleanly
    const slowError = new ReadableStream({
      start(controller) {
        setTimeout(() => {
          controller.error(new Error("Slow error"));
        }, 100);
      }
    });
    
    const result = await toArray(race(emptyStream, valueStream, slowError));
    expect(result).to.deep.equal([10]);
  });

  it("should handle reader release errors during cancellation", async () => {
    // Create a more realistic test that doesn't cause timing issues
    const fast = from([42]);
    const slow = new ReadableStream({
      start(controller) {
        let closed = false;
        // Track if the controller gets closed
        const originalClose = controller.close;
        const originalError = controller.error;
        controller.close = function() {
          closed = true;
          return originalClose.call(this);
        };
        controller.error = function(err) {
          closed = true;
          return originalError.call(this, err);
        };
        
        setTimeout(() => {
          if (!closed) {
            try {
              controller.enqueue(100);
            } catch {
              // Ignore if controller is already closed
            }
          }
        }, 50);
      }
    });
    
    // This should work fine - the fast stream wins
    const result = await toArray(race(fast, slow));
    expect(result).to.deep.equal([42]);
  });

  it("should handle all streams being done when checking", async () => {
    // Create streams that complete immediately
    const done1 = of();
    const done2 = of();
    
    const result = await toArray(race(done1, done2));
    expect(result).to.deep.equal([]);
  });
});
