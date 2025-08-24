import { expect } from "chai";
import { from, pipe, toArray, mergeAll, mapSync, defer } from "../../src/index.js";
import { VirtualTimeScheduler } from "../../src/testing/virtual-tick-scheduler.js";
import { sleep } from "../../src/utils/sleep.js";


describe("mergeAll", () => {
  describe("Real Time", () => {
    it("should flatten streams concurrently", async () => {
      const result = await toArray(pipe(
        from([
          from([1, 2]),
          from([3, 4])
        ]),
        mergeAll()
      ));
      expect(result.sort()).to.deep.equal([1, 2, 3, 4]);
    });

    it("should handle empty outer stream", async () => {
      const result = await toArray(pipe(
        from([]),
        mergeAll()
      ));
      expect(result).to.deep.equal([]);
    });

    it("should handle outer stream with empty inner streams", async () => {
      const result = await toArray(pipe(
        from([
          from([]),
          from([])
        ]),
        mergeAll()
      ));
      expect(result).to.deep.equal([]);
    });

    it("should handle stream errors in outer stream", async () => {
      const errorStream = new ReadableStream({
        start(controller) {
          controller.error(new Error("Outer stream error"));
        }
      });

      try {
        await toArray(
          pipe(
            errorStream,
            mergeAll()
          )
        );
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err.message).to.equal("Outer stream error");
      }
    });

    it("should handle stream errors in inner streams", async () => {
      const errorInnerStream = new ReadableStream({
        start(controller) {
          controller.enqueue(1);
          controller.error(new Error("Inner stream error"));
        }
      });

      const input = [from([1]), errorInnerStream];

      try {
        await toArray(
          pipe(
            from(input),
            mergeAll()
          )
        );
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err.message).to.equal("Inner stream error");
      }
    });

    it("should handle mixed stream types", async () => {
      const asyncStream = new ReadableStream({
        async start(controller) {
          await new Promise(resolve => setTimeout(resolve, 10));
          controller.enqueue(1);
          await new Promise(resolve => setTimeout(resolve, 5));
          controller.enqueue(2);
          controller.close();
        }
      });

      const result = await toArray(pipe(
        from([
          from([3, 4]),
          asyncStream
        ]),
        mergeAll()
      ));
      expect(result.sort()).to.deep.equal([1, 2, 3, 4]);
    });

    it("should handle stream of promises and merge in completion order", async ()=>{
      // Infinite concurrency shows full parallel completion order
      // With these delays, full parallel completion is [3,2,1]. 
      // i.e. because they're all running concurrent and racing, the task/stream 
      // to complete first is output first. 
      const input = [1,2,3];
      const delays: Record<number, number> = { 1: 100, 2: 90, 3: 1 };
      const expectedParallelOrder = [3,2,1];

      // Use defer to avoid eager execution and make timing explicit
      const streams = input.map(x => defer(async () => {
        await sleep(delays[x]);
        return from([x]);
      }));

      const result = await toArray(pipe(
        from(streams), 
        mergeAll(Infinity)
      ));
      expect(result, "resolve order is correct for infinite concurrency").to.deep.eq(expectedParallelOrder);
    })    
    
    it("should handle stream of promises and NOT merge in completion order due to concurrently limit", async ()=>{
      // Construct a deterministic counterexample for concurrency limiting
      // One slot only: start [1], then [2], then [3] 
      // Delays chosen so full parallel order would be [3,2,1], but with limit=1 we get [1,2,3]
      const input = [1,2,3];
      const delays: Record<number, number> = { 1: 100, 2: 90, 3: 1 };
      const expectedParallelOrder = [3,2,1];

      const streams = input.map(x => defer(async () => {
        await sleep(delays[x]);
        return from([x]);
      }));

      const result = await toArray(pipe(
        from(streams),
        mergeAll(1)
      ));

      // With concurrency=1, actual should be [1,2,3]
      expect(result, "limited concurrency should alter completion order").to.not.deep.eq(expectedParallelOrder);
      expect(result).to.deep.equal([1, 2, 3]);
    })
  });

  describe("Virtual Time", () => {
    it("should merge inner streams with timing", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(async ({ cold, expectStream }) => {
        const inner1 = cold("ab|");
        const inner2 = cold("-c|");
        const source = cold("(xy)|", { x: inner1, y: inner2 });
        
        const result = pipe(source, mergeAll());
        expectStream(result).toBe("a(bc)|");
      });
    });

    it("should handle delayed inner stream emissions", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(async ({ cold, expectStream }) => {
        const fast = cold("a|");
        const slow = cold("--b|");
        const source = cold("(xy)|", { x: fast, y: slow });
        
        const result = pipe(source, mergeAll());
        expectStream(result).toBe("a-b|");
      });
    });

    it("should handle nested completion timing", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(async ({ cold, expectStream }) => {
        const quick = cold("a|");
        const medium = cold("-b-|");
        const slow = cold("---c|");
        const source = cold("(xyz)|", { x: quick, y: medium, z: slow });
        
        const result = pipe(source, mergeAll());
        expectStream(result).toBe("ab-c|");
      });
    });

    it("should handle concurrent inner streams", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(async ({ cold, expectStream }) => {
        const stream1 = cold("a-c|");
        const stream2 = cold("-b-d|");
        const source = cold("(xy)|", { x: stream1, y: stream2 });
        
        const result = pipe(source, mergeAll());
        expectStream(result).toBe("abcd|");
      });
    });

    it("should handle inner stream errors", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(async ({ cold, expectStream }) => {
        const error = new Error("Inner error");
        const good = cold("a-b|");
        const bad = cold("-#", {}, error);
        const source = cold("(xy)|", { x: good, y: bad });
        
        const result = pipe(source, mergeAll());
        expectStream(result).toBe("a#", {}, error);
      });
    });

    it("should handle empty inner streams", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(async ({ cold, expectStream }) => {
        const empty1 = cold("|");
        const empty2 = cold("-|");
        const withData = cold("--a|");
        const source = cold("(xyz)|", { x: empty1, y: empty2, z: withData });
        
        const result = pipe(source, mergeAll());
        expectStream(result).toBe("--a|");
      });
    });

    it("should complete only after all inner streams complete", async () => {
      const scheduler = new VirtualTimeScheduler();
      await scheduler.run(async ({ cold, expectStream }) => {
        const short = cold("a|");
        const long = cold("---b---|");
        const source = cold("(xy)|", { x: short, y: long });
        
        const result = pipe(source, mergeAll());
        expectStream(result).toBe("a--b---|");
      });
    });
  });
});
