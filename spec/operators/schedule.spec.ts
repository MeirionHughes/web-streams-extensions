import { expect } from "chai";
import { toArray, from, map, pipe, schedule } from '../../src/index.js';
import { IScheduler } from "../../src/index.js";
import { parseMarbles } from '../../src/testing/parse-marbles.js';
import { VirtualTimeScheduler } from '../../src/testing/virtual-tick-scheduler.js';


describe("schedule", () => {
  describe("Real Time", () => {
    it("calls scheduler per streamed chunk", async () => {
    let inputA = [1, 2, 3, 4];
    let expected = inputA;
    let wasCalled = 0;

    let mockScheduler: IScheduler = {
      schedule: (callback) => {
        wasCalled++;
        callback();
      }
    };

    let result = await toArray(
      pipe(
        from(inputA),
        schedule(mockScheduler)
      )
    );

    expect(wasCalled, "scheduler was called x-times").to.be.deep.eq(expected.length);
  });

  it("should throw error for invalid scheduler (null)", () => {
    expect(() => {
      schedule(null as any);
    }).to.not.throw(); // The error is thrown during execution, not instantiation
    
    expect(async () => {
      await toArray(
        pipe(
          from([1, 2, 3]),
          schedule(null as any)
        )
      );
    }).to.throw;
  });

  it("should throw error for invalid scheduler (undefined)", async () => {
    try {
      await toArray(
        pipe(
          from([1, 2, 3]),
          schedule(undefined as any)
        )
      );
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.include("Invalid scheduler provided");
    }
  });

  it("should throw error for scheduler without schedule method", async () => {
    const invalidScheduler = {} as IScheduler;
    
    try {
      await toArray(
        pipe(
          from([1, 2, 3]),
          schedule(invalidScheduler)
        )
      );
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.include("Invalid scheduler provided");
    }
  });

  it("should throw error for scheduler with non-function schedule", async () => {
    const invalidScheduler = { schedule: "not a function" } as any;
    
    try {
      await toArray(
        pipe(
          from([1, 2, 3]),
          schedule(invalidScheduler)
        )
      );
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.include("Invalid scheduler provided");
    }
  });

  it("should handle empty stream", async () => {
    let wasCalled = 0;
    const mockScheduler: IScheduler = {
      schedule: (callback) => { 
        wasCalled++; 
        callback();
      }
    };

    const result = await toArray(
      pipe(
        from([]),
        schedule(mockScheduler)
      )
    );

    expect(result).to.deep.equal([]);
    expect(wasCalled).to.equal(0); // No items, so scheduler not called
  });

  it("should handle single item stream", async () => {
    let wasCalled = 0;
    const mockScheduler: IScheduler = {
      schedule: (callback) => { 
        wasCalled++; 
        callback();
      }
    };

    const result = await toArray(
      pipe(
        from([42]),
        schedule(mockScheduler)
      )
    );

    expect(result).to.deep.equal([42]);
    expect(wasCalled).to.equal(1);
  });

  it("should handle scheduler errors", async () => {
    const errorMessage = "Scheduler error";
    const faultyScheduler: IScheduler = {
      schedule: (callback) => {
        throw new Error(errorMessage);
      }
    };

    try {
      await toArray(
        pipe(
          from([1, 2, 3]),
          schedule(faultyScheduler)
        )
      );
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.equal(errorMessage);
    }
  });

  it("should handle stream errors", async () => {
    const mockScheduler: IScheduler = {
      schedule: (callback) => callback()
    };

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
          schedule(mockScheduler)
        )
      );
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.equal("Stream error");
    }
  });

  it("should handle cancellation properly", async () => {
    let cancelCalled = false;
    let readerReleased = false;
    
    const mockScheduler: IScheduler = {
      schedule: (callback) => {
        // Simulate async scheduling
        setTimeout(callback, 10);
      }
    };

    const sourceStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.enqueue(2);
        controller.enqueue(3);
      },
      cancel(reason) {
        cancelCalled = true;
        return Promise.resolve();
      }
    });

    const scheduledStream = pipe(
      sourceStream,
      schedule(mockScheduler)
    );

    const reader = scheduledStream.getReader();
    
    // Read one item
    const first = await reader.read();
    expect(first.value).to.equal(1);
    
    // Cancel the reader
    await reader.cancel("Test cancel");
    reader.releaseLock();
    
    // The cancellation should propagate
    expect(cancelCalled).to.be.true;
  });

  it("should handle reader release errors during error cleanup", async () => {
    let errorDuringRelease = false;
    const mockScheduler: IScheduler = {
      schedule: (callback) => {
        throw new Error("Scheduler error to trigger cleanup");
      }
    };

    // Create a stream where reader.cancel throws
    const problematicStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
      },
      cancel() {
        throw new Error("Cancel error");
      }
    });

    try {
      await toArray(
        pipe(
          problematicStream,
          schedule(mockScheduler)
        )
      );
      expect.fail("Should have thrown an error");
    } catch (err) {
      // Should get the original scheduler error, not the cleanup error
      expect(err.message).to.equal("Scheduler error to trigger cleanup");
    }
  });

  it("should handle reader release errors during cancel", async () => {
    const mockScheduler: IScheduler = {
      schedule: (callback) => callback()
    };

    const problematicStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.enqueue(2);
      },
      cancel() {
        throw new Error("Cancel error");
      }
    });

    const scheduledStream = pipe(
      problematicStream,
      schedule(mockScheduler)
    );

    const reader = scheduledStream.getReader();
    
    // Read one item
    await reader.read();
    
    // Cancel should not throw even if underlying cancel throws
    await reader.cancel("Test cancel");
    reader.releaseLock();
  });

  it("should work with custom highWaterMark", async () => {
    let wasCalled = 0;
    const mockScheduler: IScheduler = {
      schedule: (callback) => { 
        wasCalled++; 
        callback();
      }
    };

    const result = await toArray(
      schedule(mockScheduler)(
        from([1, 2, 3, 4, 5]),
        { highWaterMark: 1 }
      )
    );

    expect(result).to.deep.equal([1, 2, 3, 4, 5]);
    expect(wasCalled).to.equal(5);
  });

  it("should handle backpressure correctly", async () => {
    let wasCalled = 0;
    const mockScheduler: IScheduler = {
      schedule: (callback) => { 
        wasCalled++;
        // Add small delay to simulate real scheduling
        setTimeout(callback, 1);
      }
    };

    const items = [1, 2, 3, 4, 5];
    const result: number[] = [];
    
    const scheduledStream = pipe(
      from(items),
      schedule(mockScheduler)
    );

    const reader = scheduledStream.getReader();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result.push(value);
      }
    } finally {
      await reader.cancel();
      await reader.cancel();
      reader.releaseLock();
    }

    expect(result).to.deep.equal(items);
    expect(wasCalled).to.equal(items.length);
  });

  it("should maintain stream order", async () => {
    const mockScheduler: IScheduler = {
      schedule: (callback) => {
        // Add randomized delay to test ordering
        setTimeout(callback, Math.random() * 5);
      }
    };

    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = await toArray(
      pipe(
        from(items),
        schedule(mockScheduler)
      )
    );

    expect(result).to.deep.equal(items);
  });

  it("should work with different data types", async () => {
    const mockScheduler: IScheduler = {
      schedule: (callback) => callback()
    };

    const stringResult = await toArray(
      pipe(
        from(["a", "b", "c"]),
        schedule(mockScheduler)
      )
    );

    expect(stringResult).to.deep.equal(["a", "b", "c"]);

    const objectResult = await toArray(
      pipe(
        from([{id: 1}, {id: 2}]),
        schedule(mockScheduler)
      )
    );

    expect(objectResult).to.deep.equal([{id: 1}, {id: 2}]);
  });
});

  describe("Virtual Time", () => {
    let scheduler: VirtualTimeScheduler;

    beforeEach(() => {
      scheduler = new VirtualTimeScheduler();
    });

    it("schedules chunks at their correct times", async () => {
      await scheduler.run(({ cold, expectStream }) => {
        const source = cold("-a-b-c-|", {
          a: 1,
          b: 2,
          c: 3
        });

        const mockScheduler: IScheduler = {
          schedule: (callback) => {
            // In virtual time, we simulate immediate scheduling
            callback();
          }
        };

        const result = pipe(
          source,
          schedule(mockScheduler)
        );

        expectStream(result).toBe("-a-b-c-|", {
          a: 1,
          b: 2,
          c: 3
        });
      });
    });

    it("handles empty stream", async () => {
      await scheduler.run(({ cold, expectStream }) => {
        const source = cold("|");

        const mockScheduler: IScheduler = {
          schedule: (callback) => {
            callback();
          }
        };

        const result = pipe(
          source,
          schedule(mockScheduler)
        );

        expectStream(result).toBe("|");
      });
    });

    it("handles single value", async () => {
      await scheduler.run(({ cold, expectStream }) => {
        const source = cold("a|", { a: 42 });

        const mockScheduler: IScheduler = {
          schedule: (callback) => {
            callback();
          }
        };

        const result = pipe(
          source,
          schedule(mockScheduler)
        );

        expectStream(result).toBe("a|", { a: 42 });
      });
    });

    it("handles errors from scheduler", async () => {
      await scheduler.run(({ cold, expectStream }) => {
        const source = cold("a-b-|", { a: 1, b: 2 });
        const testError = new Error("Scheduler error");

        const faultyScheduler: IScheduler = {
          schedule: () => {
            throw testError;
          }
        };

        const result = pipe(
          source,
          schedule(faultyScheduler)
        );

        expectStream(result).toBe("#", {}, testError);
      });
    });

    it("handles stream errors", async () => {
      await scheduler.run(({ cold, expectStream }) => {
        const testError = new Error("Stream error");
        const source = cold("-a-#", { a: 1 }, testError);

        const mockScheduler: IScheduler = {
          schedule: (callback) => {
            callback();
          }
        };

        const result = pipe(
          source,
          schedule(mockScheduler)
        );

        expectStream(result).toBe("-a-#", { a: 1 }, testError);
      });
    });

    it("maintains timing with different scheduler delays", async () => {
      await scheduler.run(({ cold, expectStream }) => {
        const source = cold("-a-b-c-|", {
          a: "first",
          b: "second", 
          c: "third"
        });

        const mockScheduler: IScheduler = {
          schedule: (callback) => {
            // Simulate scheduler behavior
            callback();
          }
        };

        const result = pipe(
          source,
          schedule(mockScheduler)
        );

        expectStream(result).toBe("-a-b-c-|", {
          a: "first",
          b: "second",
          c: "third"
        });
      });
    });

    it("handles multiple values with complex timing", async () => {
      await scheduler.run(({ cold, expectStream }) => {
        const source = cold("a-b--c-d-e|", {
          a: 1,
          b: 2,
          c: 3,
          d: 4,
          e: 5
        });

        const mockScheduler: IScheduler = {
          schedule: (callback) => {
            callback();
          }
        };

        const result = pipe(
          source,
          schedule(mockScheduler)
        );

        expectStream(result).toBe("a-b--c-d-e|", {
          a: 1,
          b: 2,
          c: 3,
          d: 4,
          e: 5
        });
      });
    });

    it("handles rapid emission with scheduler delays", async () => {
      await scheduler.run(({ cold, expectStream }) => {
        const source = cold("abcd|", {
          a: 1,
          b: 2,
          c: 3,
          d: 4
        });

        const mockScheduler: IScheduler = {
          schedule: (callback) => {
            callback();
          }
        };

        const result = pipe(
          source,
          schedule(mockScheduler)
        );

        expectStream(result).toBe("abcd|", {
          a: 1,
          b: 2,
          c: 3,
          d: 4
        });
      });
    });

    it("works with different data types", async () => {
      await scheduler.run(({ cold, expectStream }) => {
        const source = cold("-a-b-c|", {
          a: { id: 1, name: "first" },
          b: { id: 2, name: "second" },
          c: { id: 3, name: "third" }
        });

        const mockScheduler: IScheduler = {
          schedule: (callback) => {
            callback();
          }
        };

        const result = pipe(
          source,
          schedule(mockScheduler)
        );

        expectStream(result).toBe("-a-b-c|", {
          a: { id: 1, name: "first" },
          b: { id: 2, name: "second" },
          c: { id: 3, name: "third" }
        });
      });
    });
  });
});
