import { expect } from "chai";
import { first, from, map, pipe, scan, toArray } from "../../src/index.js";
import { parseMarbles } from "../../src/testing/parse-marbles.js";
import { VirtualTimeScheduler } from "../../src/testing/virtual-tick-scheduler.js";


describe("scan", () => {
  describe("Real Time", () => {
    it("should emit accumulated values including seed", async () => {
      const input = [1, 2, 3, 4];
      const expected = [1, 3, 6, 10]; // accumulated values without initial seed
      
      const result = await toArray(pipe(
        from(input),
        scan((acc, val) => acc + val, 0), 
        {highWaterMark: 16}
      ));
      
      expect(result).to.deep.equal(expected);
    });

    it("should work with different types", async () => {
      const input = [1, 2, 3];
      const expected = ["1", "12", "123"];
      
      const result = await toArray(pipe(
        from(input),
        scan((acc, val) => acc + val.toString(), "")
      ));
      
      expect(result).to.deep.equal(expected);
    });

    it("should pass index to accumulator", async () => {
      const input = [10, 20, 30];
      const expected = [110, 131, 163]; // 100 + (10+0), 110 + (20+1), 131 + (30+2)
      
      const result = await toArray(pipe(
        from(input),
        scan((acc, val, index) => acc + val + index, 100)
      ));
      
      expect(result).to.deep.equal(expected);
    });

    it("should handle async accumulator", async () => {
      const input = [1, 2, 3];
      const expected = [1, 3, 6];
      
      const result = await toArray(pipe(
        from(input),
        scan(async (acc, val) => {
          await new Promise(resolve => setTimeout(resolve, 1));
          return acc + val;
        }, 0)
      ));
      
      expect(result).to.deep.equal(expected);
    });

    it("should handle empty stream", async () => {
      const result = await toArray(pipe(
        from([]),
        scan((acc, val) => acc + val, 42)
      ));
      
      expect(result).to.deep.equal([]); // Empty stream should emit nothing
    });

    it("should propagate errors from source stream", async () => {
      const source = new ReadableStream({
        start(controller) {
          controller.enqueue(1);
          controller.enqueue(2);
          controller.error(new Error("Source error"));
        }
      });

      try {
        await toArray(pipe(
          source,
          scan((acc, val) => acc + val, 0)
        ));
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).to.equal("Source error");
      }
    });

    it("should propagate errors from accumulator function", async () => {
      const input = [1, 2, 3];
      
      try {
        await toArray(pipe(
          from(input),
          scan((acc, val) => {
            if (val === 2) throw new Error("Accumulator error");
            return acc + val;
          }, 0)
        ));
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).to.equal("Accumulator error");
      }
    });
  });

  describe("Virtual Time", () => {
    it("should emit accumulated values with proper timing", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(({ cold, expectStream }) => {
        const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
        
        const result = pipe(
          source,
          scan((acc: number, val: number) => acc + val, 0)
        );
        
        expectStream(result).toBe("a-b-c|", { a: 1, b: 3, c: 6 });
      });
    });

    it("should handle type transformations", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(({ cold, expectStream }) => {
        const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
        
        const result = pipe(
          source,
          scan((acc: string, val: number) => acc + val.toString(), "")
        );
        
        expectStream(result).toBe("a-b-c|", { a: "1", b: "12", c: "123" });
      });
    });

    it("should handle index parameter in accumulator", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(({ cold, expectStream }) => {
        const source = cold("a-b-c|", { a: 10, b: 20, c: 30 });
        
        const result = pipe(
          source,
          scan((acc: number, val: number, index: number) => acc + val + index, 100)
        );
        
        expectStream(result).toBe("a-b-c|", { a: 110, b: 131, c: 163 });
      });
    });

    it("should propagate errors from source", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(({ cold, expectStream }) => {
        const error = new Error("Source error");
        const source = cold("a-b-#", { a: 1, b: 2 }, error);
        
        const result = pipe(
          source,
          scan((acc: number, val: number) => acc + val, 0)
        );
        
        expectStream(result).toBe("a-b-#", { a: 1, b: 3 }, error);
      });
    });

    it("should propagate errors from accumulator function", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(({ cold, expectStream }) => {
        const error = new Error("Accumulator error");
        const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
        
        const result = pipe(
          source,
          scan((acc: number, val: number) => {
            if (val === 2) throw error;
            return acc + val;
          }, 0)
        );
        
        expectStream(result).toBe("a-#", { a: 1 }, error);
      });
    });

    it("should handle empty stream with seed", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(({ cold, expectStream }) => {
        const source = cold("|", {} as Record<string, number>, undefined);
        
        const result = pipe(
          source,
          scan((acc: number, val: number) => acc + val, 42)
        );
        
        expectStream(result).toBe("|"); // Empty stream should emit nothing
      });
    });

    it("should handle scan without seed", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(({ cold, expectStream }) => {
        const source = cold("a-b-c|", { a: 1, b: 2, c: 3 });
        
        const result = pipe(
          source,
          scan((acc: number, val: number) => acc + val) // No seed provided
        );
        
        expectStream(result).toBe("a-b-c|", { a: 1, b: 3, c: 6 }); // First value (1) emitted directly
      });
    });

    it("should handle complex object accumulation", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(({ cold, expectStream }) => {
        const source = cold("a-b-c|", { a: 'x', b: 'y', c: 'z' });
        
        const result = pipe(
          source,
          scan((acc: { items: string[] }, val: string) => {
            return { items: [...acc.items, val] };
          }, { items: [] })
        );
        
        expectStream(result).toBe("a-b-c|", { 
          a: { items: ['x'] }, 
          b: { items: ['x', 'y'] },
          c: { items: ['x', 'y', 'z'] }
        });
      });
    });

    it("should handle long streams with delays", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(({ cold, expectStream }) => {
        const source = cold("a------b------c------|", { a: 1, b: 2, c: 3 });
        
        const result = pipe(
          source,
          scan((acc: number, val: number) => acc + val, 0)
        );
        
        expectStream(result).toBe("a------b------c------|", { a: 1, b: 3, c: 6 });
      });
    });

    it("should handle stream with no values", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(({ cold, expectStream }) => {
        const source = cold("-----|", {}, undefined); // Just delay, then complete
        
        const result = pipe(
          source,
          scan((acc: number, val: number) => acc + val, 5)
        );
        
        expectStream(result).toBe("-----|"); // No emissions for empty stream
      });
    });

    it("should handle synchronous emissions", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(({ cold, expectStream }) => {
        const source = cold("(abc)|", { a: 1, b: 2, c: 3 });
        
        const result = pipe(
          source,
          scan((acc: number, val: number) => acc + val, 0)
        );
        
        expectStream(result).toBe("(abc)|", { a: 1, b: 3, c: 6 });
      });
    });

    it("should handle large accumulations", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(({ cold, expectStream }) => {
        const source = cold("a-b-c-d-e|", { a: 10, b: 20, c: 30, d: 40, e: 50 });
        
        const result = pipe(
          source,
          scan((acc: number, val: number) => acc + val, 0)
        );
        
        expectStream(result).toBe("a-b-c-d-e|", { 
          a: 10, b: 30, c: 60, d: 100, e: 150 
        });
      });
    });

    it("should handle single value stream", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(({ cold, expectStream }) => {
        const source = cold("a|", { a: 5 });
        
        const result = pipe(
          source,
          scan((acc: number, val: number) => acc + val, 10)
        );
        
        expectStream(result).toBe("a|", { a: 15 });
      });
    });

    it("should handle single value stream without seed", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(({ cold, expectStream }) => {
        const source = cold("a|", { a: 5 });
        
        const result = pipe(
          source,
          scan((acc: number, val: number) => acc + val) // No seed
        );
        
        expectStream(result).toBe("a|", { a: 5 }); // First value emitted directly
      });
    });
  });
});
