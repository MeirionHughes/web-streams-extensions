import { expect } from "chai";
import { toArray, from, pipe, buffer, take, timeout } from '../../src/index.js';
import { VirtualTimeScheduler } from "../../src/testing/virtual-tick-scheduler.js";


describe("take", () => {
  describe("Real Time", () => {
    it("can take less than input ", async () => {
    let inputA = [1, 2, 3, 4, 5];
    let expected = [1, 2, 3]

    let result = await toArray(
      pipe(
        from(inputA),
        take(3))
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })

  it("can take more than input ", async () => {
    let inputA = [1, 2, 3, 4];
    let expected = [1, 2, 3, 4]

    let result = await toArray(
      pipe(
        from(inputA),
        take(10))
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  }) 
  
  it("can take none ", async () => {
    let inputA = [1, 2, 3, 4];
    let expected = []

    let result = await toArray(
      pipe(
        from(inputA),
        take(0))
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })

  it("should throw error for negative count", () => {
    expect(() => take(-1)).to.throw("Take count must be non-negative");
  });

  it("should handle empty stream", async () => {
    const result = await toArray(
      pipe(
        from([]),
        take(5)
      )
    );

    expect(result).to.deep.equal([]);
  });

  it("should handle stream errors", async () => {
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.error(new Error('Stream error'));
      }
    });

    try {
      await toArray(
        pipe(
          errorStream,
          take(5)
        )
      );
      expect.fail('Expected stream to throw error');
    } catch (err) {
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal('Stream error');
    }
  });

  it("should handle cancellation", async () => {
    const stream = pipe(
      from([1, 2, 3, 4, 5]),
      take(10)
    );

    const reader = stream.getReader();
    
    // Read first value
    const first = await reader.read();
    expect(first.value).to.equal(1);
    
    // Cancel the stream
    await reader.cancel('User cancelled');
    // If we get here, cancellation was handled
    expect(true).to.be.true;
  });

  it("should handle cleanup errors during cancellation", async () => {
    // Create a stream that throws on cancel
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.enqueue(2);
      },
      cancel() {
        throw new Error('Cancel error');
      }
    });

    const stream = pipe(mockStream, take(3));
    const reader = stream.getReader();
    
    await reader.read(); // Read first value
    
    // Should handle cancel errors gracefully
    await reader.cancel('test cancel');
    // If we get here, it handled the cleanup error
    expect(true).to.be.true;
  });

  it("should handle cleanup errors when reader is cancelled after taking enough", async () => {
    // Create a stream that throws on cancel
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.enqueue(2);
        controller.enqueue(3);
        controller.enqueue(4);
      },
      cancel() {
        throw new Error('Cancel error');
      }
    });

    // Take exactly what we provide - this will trigger cancellation
    const result = await toArray(
      pipe(mockStream, take(2))
    );
    
    expect(result).to.deep.equal([1, 2]);
  });

  it("should work with custom highWaterMark", async () => {
    const result = await toArray(
      pipe(
        from([1, 2, 3, 4, 5]),
        (src) => take(3)(src, { highWaterMark: 1 })
      )
    );

    expect(result).to.deep.equal([1, 2, 3]);
  });

  it("should handle source stream completion before reaching count", async () => {
    const result = await toArray(
      pipe(
        from([1, 2]),
        take(5)
      )
    );

    expect(result).to.deep.equal([1, 2]);
  });

  it("should handle backpressure correctly", async () => {
    // Test with a stream that has backpressure
    const stream = pipe(
      from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
      take(3)
    );

    const result = await toArray(stream);
    expect(result).to.deep.equal([1, 2, 3]);
  });

  it("should close immediately when count is 0", async () => {
    const stream = pipe(
      from([1, 2, 3]),
      take(0)
    );

    // Stream should be closed immediately
    const reader = stream.getReader();
    const result = await reader.read();
    expect(result.done).to.be.true;
  });

  it("should handle reader release errors during error cleanup", async () => {
    // Create a custom stream that will error during read
    const errorStream = new ReadableStream({
      async start(controller) {
        controller.enqueue(1);
        // This will trigger an error in the read loop
        await new Promise(resolve => setTimeout(resolve, 10));
        controller.error(new Error('Async error'));
      }
    });

    try {
      await toArray(
        pipe(
          errorStream,
          take(5)
        )
      );
      expect.fail('Expected stream to throw error');
    } catch (err) {
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal('Async error');
    }
  });

  it("should handle taking exactly one element", async () => {
    const result = await toArray(
      pipe(
        from([1, 2, 3, 4, 5]),
        take(1)
      )
    );

    expect(result).to.deep.equal([1]);
  });

  it("should handle very large count", async () => {
    const result = await toArray(
      pipe(
        from([1, 2, 3]),
        take(Number.MAX_SAFE_INTEGER)
      )
    );

    expect(result).to.deep.equal([1, 2, 3]);
  });
  });

  describe("Virtual Time", () => {
    describe("Basic Take Behavior", () => {
      it("should take specified number of values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c-d-e|", { a: 1, b: 2, c: 3, d: 4, e: 5 });
          
          const result = pipe(
            source,
            take(3)
          );
          
          expectStream(result).toBe("a-b-(c|)", { a: 1, b: 2, c: 3 });
        });
      });

      it("should take zero values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            take(0)
          );
          
          expectStream(result).toBe("|");
        });
      });

      it("should take one value", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            take(1)
          );
          
          expectStream(result).toBe("(a|)", { a: 1 });
        });
      });

      it("should take more than available", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b|", { a: 1, b: 2 });
          
          const result = pipe(
            source,
            take(5)
          );
          
          expectStream(result).toBe("a-b|", { a: 1, b: 2 });
        });
      });

      it("should take all values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            take(3)
          );
          
          expectStream(result).toBe("a-b-(c|)", { a: 1, b: 2, c: 3 });
        });
      });

      it("should handle single value", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a|", { a: 42 });
          
          const result = pipe(
            source,
            take(1)
          );
          
          expectStream(result).toBe("(a|)", { a: 42 });
        });
      });

      it("should handle large take count", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            take(1000)
          );
          
          expectStream(result).toBe("a-b-c|", { a: 1, b: 2, c: 3 });
        });
      });
    });

    describe("Timing Patterns", () => {
      it("should maintain source timing for taken values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a---b--c----d|", { a: 1, b: 2, c: 3, d: 4 });
          
          const result = pipe(
            source,
            take(3)
          );
          
          expectStream(result).toBe("a---b--(c|)", { a: 1, b: 2, c: 3 });
        });
      });

      it("should handle immediate completion with grouped emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("(abc)d-e|", { a: 1, b: 2, c: 3, d: 4, e: 5 });
          
          const result = pipe(
            source,
            take(2)
          );
          
          expectStream(result).toBe("(ab|)", { a: 1, b: 2 });
        });
      });

      it("should handle spaced emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a--b--c--d--e|", { a: 1, b: 2, c: 3, d: 4, e: 5 });
          
          const result = pipe(
            source,
            take(3)
          );
          
          expectStream(result).toBe("a--b--(c|)", { a: 1, b: 2, c: 3 });
        });
      });

      it("should handle delayed start", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("-----a-b-c|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            take(2)
          );
          
          expectStream(result).toBe("-----a-(b|)", { a: 1, b: 2 });
        });
      });

      it("should handle long delays between values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a----------b----------c|", { a: 1, b: 2, c: 3 });
          
          const result = pipe(
            source,
            take(2)
          );
          
          expectStream(result).toBe("a----------(b|)", { a: 1, b: 2 });
        });
      });

      it("should complete immediately after taking required count", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c-d-e-f|", { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
          
          const result = pipe(
            source,
            take(4)
          );
          
          expectStream(result).toBe("a-b-c-(d|)", { a: 1, b: 2, c: 3, d: 4 });
        });
      });
    });

    describe("Empty and Edge Cases", () => {
      it("should handle empty stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("|", {} as Record<string, number>);
          
          const result = pipe(
            source,
            take(3)
          );
          
          expectStream(result).toBe("|");
        });
      });

      it("should handle never stream with timeout", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("-", {} as Record<string, number>);
          
          const result = pipe(
            source,
            take(3),
            timeout(10)
          );
          
          expectStream(result).toBe("----------#", {}, Error("Stream timeout after 10ms"));
        });
      });

      it("should handle completion during take phase", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b|", { a: 1, b: 2 });
          
          const result = pipe(
            source,
            take(5)
          );
          
          expectStream(result).toBe("a-b|", { a: 1, b: 2 });
        });
      });

      it("should handle delayed completion", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a--------|", { a: 1 });
          
          const result = pipe(
            source,
            take(3)
          );
          
          expectStream(result).toBe("a--------|", { a: 1 });
        });
      });

      it("should handle zero emissions before completion", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("------|", {} as Record<string, number>);
          
          const result = pipe(
            source,
            take(3)
          );
          
          expectStream(result).toBe("------|");
        });
      });
    });

    describe("Error Handling", () => {
      it("should propagate errors from source", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Source error");
          const source = cold("a-b-#", { a: 1, b: 2 }, error);
          
          const result = pipe(
            source,
            take(5)
          );
          
          expectStream(result).toBe("a-b-#", { a: 1, b: 2 }, error);
        });
      });

      it("should propagate immediate errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Immediate error");
          const source = cold("#", {}, error);
          
          const result = pipe(
            source,
            take(3)
          );
          
          expectStream(result).toBe("#", {}, error);
        });
      });

      it("should propagate errors before take count reached", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Early error");
          const source = cold("a-#", { a: 1 }, error);
          
          const result = pipe(
            source,
            take(5)
          );
          
          expectStream(result).toBe("a-#", { a: 1 }, error);
        });
      });

      it("should complete before error if take count reached", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Later error");
          const source = cold("a-b-c-#", { a: 1, b: 2, c: 3 }, error);
          
          const result = pipe(
            source,
            take(2)
          );
          
          expectStream(result).toBe("a-(b|)", { a: 1, b: 2 });
        });
      });

      it("should handle errors with grouped emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Grouped error");
          const source = cold("(ab)#", { a: 1, b: 2 }, error);
          
          const result = pipe(
            source,
            take(5)
          );
          
          expectStream(result).toBe("(ab)#", { a: 1, b: 2 }, error);
        });
      });

      it("should complete if count reached within grouped error", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const error = new Error("Grouped error");
          const source = cold("(abc)#", { a: 1, b: 2, c: 3 }, error);
          
          const result = pipe(
            source,
            take(2)
          );
          
          expectStream(result).toBe("(ab|)", { a: 1, b: 2 });
        });
      });
    });

    describe("Data Types", () => {
      it("should work with strings", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c-d|", { a: "hello", b: "world", c: "foo", d: "bar" });
          
          const result = pipe(
            source,
            take(3)
          );
          
          expectStream(result).toBe("a-b-(c|)", { a: "hello", b: "world", c: "foo" });
        });
      });

      it("should work with objects", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { 
            a: { id: 1 }, 
            b: { id: 2 }, 
            c: { id: 3 } 
          });
          
          const result = pipe(
            source,
            take(2)
          );
          
          expectStream(result).toBe("a-(b|)", { 
            a: { id: 1 }, 
            b: { id: 2 } 
          });
        });
      });

      it("should work with mixed types", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c-d|", { a: 1, b: "hello", c: true, d: null });
          
          const result = pipe(
            source,
            take(3)
          );
          
          expectStream(result).toBe("a-b-(c|)", { a: 1, b: "hello", c: true });
        });
      });

      it("should work with arrays", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c|", { 
            a: [1, 2], 
            b: [3, 4], 
            c: [5, 6] 
          });
          
          const result = pipe(
            source,
            take(2)
          );
          
          expectStream(result).toBe("a-(b|)", { 
            a: [1, 2], 
            b: [3, 4] 
          });
        });
      });

      it("should work with boolean values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c-d|", { a: true, b: false, c: true, d: false });
          
          const result = pipe(
            source,
            take(3)
          );
          
          expectStream(result).toBe("a-b-(c|)", { a: true, b: false, c: true });
        });
      });

      it("should work with zero and falsy values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c-d|", { a: 0, b: "", c: false, d: null });
          
          const result = pipe(
            source,
            take(3)
          );
          
          expectStream(result).toBe("a-b-(c|)", { a: 0, b: "", c: false });
        });
      });
    });

    describe("Subscription Timing", () => {
      it("should handle late subscription", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("ab^c-d-e|", { a: 1, b: 2, c: 3, d: 4, e: 5 });
          
          const result = pipe(
            source,
            take(3)
          );
          
          expectStream(result).toBe("c-d-(e|)", { c: 3, d: 4, e: 5 });
        });
      });

      it("should handle subscription during take phase", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b^c-d-e|", { a: 1, b: 2, c: 3, d: 4, e: 5 });
          
          const result = pipe(
            source,
            take(2)
          );
          
          expectStream(result).toBe("c-(d|)", { c: 3, d: 4 });
        });
      });

      it("should handle subscription after enough values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b-c^d-e|", { a: 1, b: 2, c: 3, d: 4, e: 5 });
          
          const result = pipe(
            source,
            take(2)
          );
          
          expectStream(result).toBe("d-(e|)", { d: 4, e: 5 });
        });
      });

      it("should handle subscription after completion", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const source = cold("a-b|^", { a: 1, b: 2 });
          
          const result = pipe(
            source,
            take(3)
          );
          
          expectStream(result).toBe("|");
        });
      });
    });
  });
});