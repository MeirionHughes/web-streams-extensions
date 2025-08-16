import { expect } from "chai";
import { from, pipe, toArray, concatMap } from "../../src/index.js";
import { VirtualTimeScheduler } from '../../src/testing/virtual-tick-scheduler.js';


describe("concatMap", () => {
  describe("Real Time", () => {
    it("should map values to streams and concatenate sequentially", async () => {
      const result = await toArray(pipe(
        from([1, 2, 3]),
        concatMap(n => from([n, n * 10]))
      ));
      expect(result).to.deep.equal([1, 10, 2, 20, 3, 30]);
    });

    it("should work with promises", async () => {
      const result = await toArray(pipe(
        from([1, 2]),
        concatMap(n => Promise.resolve(n * 2))
      ));
      expect(result).to.deep.equal([2, 4]);
    });

    it("should work with arrays", async () => {
      const result = await toArray(pipe(
        from(['a', 'b']),
        concatMap(letter => [letter, letter.toUpperCase()])
      ));
      expect(result).to.deep.equal(['a', 'A', 'b', 'B']);
    });
  });

  describe("Virtual Time", () => {
    describe("Basic Behavior", () => {
      it("should handle empty stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('|');
          const result = pipe(stream, concatMap((x: number) => cold('ab|', { a: x + 1, b: x + 2 })));
          expectStream(result).toBe('|');
        });
      });

      it("should map and concatenate streams sequentially", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, concatMap((x: number) => cold('xy|', { x: x, y: x * 10 })));
          expectStream(result).toBe('xypqrs|', { 
            x: 1, y: 10, // First mapped stream
            p: 2, q: 20, 
            r: 3, s: 30
          });
        });
      });

      it("should handle single source value", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a|', { a: 5 });
          const result = pipe(stream, concatMap((x: number) => cold('pqr|', { p: x, q: x + 1, r: x + 2 })));
          expectStream(result).toBe('pqr|', { p: 5, q: 6, r: 7 });
        });
      });

      it("should handle projected streams with different values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab|', { a: 1, b: 2 });
          const result = pipe(stream, concatMap((x: number) => {
            if (x === 1) return cold('pq|', { p: 10, q: 11 });
            if (x === 2) return cold('rs|', { r: 20, s: 21 });
            return cold('|');
          }));
          expectStream(result).toBe('pqrs|', { p: 10, q: 11, r: 20, s: 21 });
        });
      });

      it("should handle empty projected streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, concatMap((x: number) => {
            if (x === 2) return cold('|'); // Empty for middle value
            return cold('x|', { x: x * 10 });
          }));
          expectStream(result).toBe('x-y|', { x: 10, y: 30 }); 
        });
      });
    });

    describe("Timing Patterns", () => {
      it("should preserve timing within projected streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab|', { a: 1, b: 2 });
          const result = pipe(stream, concatMap((x: number) => cold('p-q|', { p: x, q: x * 10 })));
          expectStream(result).toBe('p-qr-s|', { p: 1, q: 10, r: 2, s: 20 }); 
        });
      });

      it("should handle spaced source timing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a---b|', { a: 1, b: 2 });
          const result = pipe(stream, concatMap(x => cold('pq|', { p: x, q: x + 10 })));
          expectStream(result).toBe('pq--rs|', { p: 1, q: 11, r: 2, s: 12 }); 
        });
      });

      it("should handle grouped source emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('(ab)|', { a: 1, b: 2 });
          const result = pipe(stream, concatMap(x => cold('pq|', { p: x, q: x + 10 })));
          expectStream(result).toBe('pqrs|', { p: 1, q: 11, r: 2, s: 12 }); // Sequential processing
        });
      });

      it("should handle delayed projected streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab|', { a: 1, b: 2 });
          const result = pipe(stream, concatMap(x => cold('--pq|', { p: x, q: x + 10 })));
          expectStream(result).toBe('--pq--rs|', { p: 1, q: 11, r: 2, s: 12 });
        });
      });

      it("should handle complex projected stream timing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-b|', { a: 1, b: 2 });
          const result = pipe(stream, concatMap(x => cold('-p-(qr)|', { p: x, q: x + 10, r: x + 20 })));
          expectStream(result).toBe('-p-(qr)-s-(tu)|', { p: 1, q: 11, r: 21, s: 2, t: 12, u: 22 });
        });
      });

      it("should handle projected streams of different lengths", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, concatMap(x => {
            if (x === 1) return cold('p|', { p: 10 });
            if (x === 2) return cold('qrs|', { q: 20, r: 21, s: 22 });
            if (x === 3) return cold('tu|', { t: 30, u: 31 });
            return cold('|');
          }));
          expectStream(result).toBe('pqrstu|', { p: 10, q: 20, r: 21, s: 22, t: 30, u: 31 });
        });
      });
    });

    describe("Error Handling", () => {
      it("should propagate source errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab#', { a: 1, b: 2 });
          const result = pipe(stream, concatMap(x => cold('pq|', { p: x, q: x + 10 })));
          expectStream(result).toBe('pqrs#', { p: 1, q: 11, r: 2, s: 12 });
        });
      });

      it("should propagate projected stream errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab|', { a: 1, b: 2 });
          const result = pipe(stream, concatMap(x => {
            if (x === 1) return cold('pq|', { p: x, q: x + 10 });
            return cold('r#', { r: x + 20 });
          }));
          expectStream(result).toBe('pqr#', { p: 1, q: 11, r: 22 });
        });
      });

      it("should handle error in projection function", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const projectionError = new Error('Projection error');
          const stream = cold('ab|', { a: 1, b: 2 });
          const result = pipe(stream, concatMap(x => {
            if (x === 2) throw projectionError;
            return cold('p|', { p: x });
          }));
          expectStream(result).toBe('p#', { p: 1 }, projectionError);
        });
      });

      it("should handle immediate error in projected stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a|', { a: 1 });
          const result = pipe(stream, concatMap(x => cold('#')));
          expectStream(result).toBe('#');
        });
      });

      it("should not process subsequent values after error", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, concatMap(x => {
            if (x === 2) return cold('p#', { p: x });
            return cold('q|', { q: x });
          }));
          expectStream(result).toBe('qp#', { q: 1, p: 2 });
        });
      });
    });

    describe("Sequential Processing", () => {
      it("should wait for each projected stream to complete", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab|', { a: 1, b: 2 });
          const result = pipe(stream, concatMap(x => cold('p---q|', { p: x, q: x + 10 })));
          expectStream(result).toBe('p---qr---s|', { p: 1, q: 11, r: 2, s: 12 });
        });
      });

      it("should maintain order regardless of projected stream completion time", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab|', { a: 1, b: 2 });
          const result = pipe(stream, concatMap(x => {
            if (x === 1) return cold('p--------q|', { p: x, q: x + 10 }); // Long stream
            return cold('r|', { r: x + 20 }); // Short stream, but waits for first
          }));
          expectStream(result).toBe('p--------qr|', { p: 1, q: 11, r: 22 });
        });
      });

      it("should handle many sequential projections", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcde|', { a: 1, b: 2, c: 3, d: 4, e: 5 });
          const result = pipe(stream, concatMap(x => cold('p|', { p: x * 10 })));
          expectStream(result).toBe('pqrst|', { p: 10, q: 20, r: 30, s: 40, t: 50 });
        });
      });
    });

    describe("Advanced Patterns", () => {
      it("should work with arrays as projection result", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab|', { a: 1, b: 2 });
          const result = pipe(stream, concatMap(x => [x, x * 10, x * 100]));
          expectStream(result).toBe('(pqr)(stu)|', { 
            p: 1, q: 10, r: 100,
            s: 2, t: 20, u: 200
          });
        });
      });

      it("should handle promises as projection result", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab|', { a: 1, b: 2 });
          const result = pipe(stream, concatMap(x => Promise.resolve(x * 10)));
          expectStream(result).toBe('pq|', { p: 10, q: 20 });
        });
      });

      it("should handle mixed projection types", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, concatMap(x => {
            if (x === 1) return cold('p|', { p: x * 10 });
            if (x === 2) return Promise.resolve(x * 100);
            return [x * 1000, x * 10000];
          }));
          expectStream(result).toBe('pq(rs)|', { 
            p: 10, 
            q: 200, 
            r: 3000, 
            s: 30000 
          });
        });
      });

      it("should handle index parameter in projector", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 10, b: 20, c: 30 });
          const result = pipe(stream, concatMap((value, index) => 
            cold('p|', { p: value + index })
          ));
          expectStream(result).toBe('pqr|', { p: 10, q: 21, r: 32 }); // 10+0, 20+1, 30+2
        });
      });

      it("should handle AbortSignal cancellation", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab|', { a: 1, b: 2 });
          const result = pipe(stream, concatMap((x, index, signal) => {
            // In real scenarios, the signal would be used to cancel async operations
            return cold('p|', { p: x * 10 });
          }));
          expectStream(result).toBe('pq|', { p: 10, q: 20 });
        });
      });
    });

    describe("Edge Cases", () => {
      it("should handle single value with complex projection", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a|', { a: 42 });
          const result = pipe(stream, concatMap(x => cold('--p--(qr)---s|', { 
            p: x, q: x + 1, r: x + 2, s: x + 3 
          })));
          expectStream(result).toBe('--p--(qr)---s|', { p: 42, q: 43, r: 44, s: 45 });
        });
      });

      it("should handle all empty projections", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, concatMap(x => cold('|')));
          expectStream(result).toBe('---|');
        });
      });

      it("should handle rapid source with slow projections", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('(abc)|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, concatMap(x => cold('----p|', { p: x * 10 })));
          expectStream(result).toBe('----p----q----r|', { p: 10, q: 20, r: 30 }); // Sequential delays
        });
      });

      it("should handle hot stream subscription pattern", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab^cd|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, concatMap(x => cold('pq|', { p: x, q: x + 10 })));
          expectStream(result).toBe('pqrs|', { p: 3, q: 13, r: 4, s: 14 }); // Only c and d processed
        });
      });
    });
  });
});
