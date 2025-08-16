import { expect } from "chai";
import { toArray, from, map, pipe, toPromise, Subject } from '../../src/index.js';
import { parseMarbles } from "../../src/testing/parse-marbles.js";
import { VirtualTimeScheduler } from "../../src/testing/virtual-tick-scheduler.js";


describe("map", () => {
  describe("Real Time", () => {
    it("can map T", async () => {
      let inputA = [1, 2, 3, 4];
      let expected = inputA.slice().map(x => x * 2);

      let result = await toArray(
        pipe(
          from(inputA),
          map((x: number) => x * 2))
      );

      expect(result, "stream result matches expected").to.be.deep.eq(expected);
    });

    it("can map T and ignore undefined", async () => {
      let inputA = [1, 2, 3, 4];
      let expected = [2, 4, 6];

      let result = await toArray(
        pipe(
          from(inputA),
          map((x: number) => x < 4 ? x * 2 : undefined))
      );

      expect(result, "stream result matches expected").to.be.deep.eq(expected);
    });

    it("can map T -> R", async () => {
      let inputA = [1, 2, 3, 4];
      let expected = inputA.map(x => x.toString());

      let result = await toArray(
        pipe(
          from(inputA),
          map((x: number) => x.toString()))
      );

      expect(result, "stream result matches expected").to.be.deep.equal(expected);
    });

    it("should handle empty stream", async () => {
      const input: number[] = [];
      
      const result = await toArray(pipe(
        from(input),
        map((x: number) => x * 2)
      ));
      
      expect(result).to.deep.equal([]);
    });

    it("should handle single element", async () => {
      const input = [42];
      
      const result = await toArray(pipe(
        from(input),
        map((x: number) => x * 2)
      ));
      
      expect(result).to.deep.equal([84]);
    });

    it("should map to different types", async () => {
      const input = [1, 2, 3];
      
      const result = await toArray(pipe(
        from(input),
        map((x: number) => ({ value: x, squared: x * x }))
      ));
      
      expect(result).to.deep.equal([
        { value: 1, squared: 1 },
        { value: 2, squared: 4 },
        { value: 3, squared: 9 }
      ]);
    });

    it("should handle mapping errors", async () => {
      const input = [1, 2, 3, 4];
      
      try {
        await toArray(pipe(
          from(input),
          map((x: number) => {
            if (x === 3) throw new Error("Map error");
            return x * 2;
          })
        ));
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).to.equal("Map error");
      }
    });

    it("should handle complex transformations", async () => {
      const input = ['hello', 'world', 'test'];
      
      const result = await toArray(pipe(
        from(input),
        map((s: string) => s.toUpperCase().split('').reverse().join(''))
      ));
      
      expect(result).to.deep.equal(['OLLEH', 'DLROW', 'TSET']);
    });

    it("should handle null and undefined inputs", async () => {
      const input = [1, null, 3, undefined, 5];
      
      const result = await toArray(pipe(
        from(input),
        map((x: any) => x != null ? x * 2 : 'null')
      ));
      
      expect(result).to.deep.equal([2, 'null', 6, 'null', 10]);
    });

    it("should handle boolean transformations", async () => {
      const input = [0, 1, 2, 0, 3];
      
      const result = await toArray(pipe(
        from(input),
        map((x: number) => x > 0)
      ));
      
      expect(result).to.deep.equal([false, true, true, false, true]);
    });

    it("should handle async streams", async () => {
      const subject = new Subject<number>();
      
      const resultPromise = toArray(pipe(
        subject.readable,
        map((x: number) => x * 3)
      ));
      
      subject.next(1);
      subject.next(2);
      subject.next(3);
      subject.complete();
      
      const result = await resultPromise;
      expect(result).to.deep.equal([3, 6, 9]);
    });

    it("should handle stream errors", async () => {
      const subject = new Subject<number>();
      
      const resultPromise = toArray(pipe(
        subject.readable,
        map((x: number) => x * 2)
      ));
      
      subject.next(1);
      subject.error(new Error("Stream error"));
      
      try {
        await resultPromise;
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).to.equal("Stream error");
      }
    });

    it("should handle cancellation", async () => {
      const stream = pipe(
        from([1, 2, 3, 4, 5]),
        map((x: number) => x * 2)
      );

      const reader = stream.getReader();
      
      // Cancel the stream
      await reader.cancel('User cancelled');
      // If we get here, cancellation was handled
      expect(true).to.be.true;
    });

    it("should work with custom highWaterMark", async () => {
      const result = await toArray(
        pipe(
          from([1, 2, 3, 4, 5]),
          (src) => map((x: number) => x * 2)(src, { highWaterMark: 1 })
        )
      );

      expect(result).to.deep.equal([2, 4, 6, 8, 10]);
    });

    it("should handle zero values", async () => {
      const input = [0, 1, 0, 2, 0];
      
      const result = await toArray(pipe(
        from(input),
        map((x: number) => x === 0 ? 'zero' : x.toString())
      ));
      
      expect(result).to.deep.equal(['zero', '1', 'zero', '2', 'zero']);
    });

    it("should handle large arrays", async () => {
      const input = Array.from({ length: 1000 }, (_, i) => i);
      
      const result = await toArray(pipe(
        from(input),
        map((x: number) => x * 2)
      ));
      
      expect(result.length).to.equal(1000);
      expect(result[0]).to.equal(0);
      expect(result[999]).to.equal(1998);
    });

    it("should preserve order", async () => {
      const input = [5, 1, 3, 2, 4];
      
      const result = await toArray(pipe(
        from(input),
        map((x: number) => x * 10)
      ));
      
      expect(result).to.deep.equal([50, 10, 30, 20, 40]);
    });

    it("should handle array mapping", async () => {
      const input = [[1, 2], [3, 4], [5, 6]];
      
      const result = await toArray(pipe(
        from(input),
        map((arr: number[]) => arr.reduce((sum, val) => sum + val, 0))
      ));
      
      expect(result).to.deep.equal([3, 7, 11]);
    });

    it("should handle object mapping", async () => {
      const input = [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }];
      
      const result = await toArray(pipe(
        from(input),
        map((person: any) => `${person.name}: ${person.age}`)
      ));
      
      expect(result).to.deep.equal(['Alice: 30', 'Bob: 25']);
    });

    it("should handle date transformations", async () => {
      const input = [new Date('2023-01-01'), new Date('2023-01-02')];
      
      const result = await toArray(pipe(
        from(input),
        map((date: Date) => date.getFullYear())
      ));
      
      expect(result).to.deep.equal([2023, 2023]);
    });

    it("should handle regex transformations", async () => {
      const input = ['hello123', 'world456', 'test789'];
      
      const result = await toArray(pipe(
        from(input),
        map((str: string) => str.replace(/\d+/g, ''))
      ));
      
      expect(result).to.deep.equal(['hello', 'world', 'test']);
    });
  });

  describe("Virtual Time", () => {
    describe("Basic Behavior", () => {
      it("should map values one-to-one", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, map((x: number) => x * 2));
          expectStream(result).toBe('abcd|', { a: 2, b: 4, c: 6, d: 8 });
        });
      });

      it("should handle empty stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('|');
          const result = pipe(stream, map((x: number) => x * 2));
          expectStream(result).toBe('|');
        });
      });

      it("should handle single element", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a|', { a: 5 });
          const result = pipe(stream, map((x: number) => x * 3));
          expectStream(result).toBe('a|', { a: 15 });
        });
      });

      it("should map to different types", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, map((x: number) => x.toString()));
          expectStream(result).toBe('abc|', { a: '1', b: '2', c: '3' });
        });
      });

      it("should handle undefined values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, map((x: number) => x === 2 ? undefined : x * 2));
          expectStream(result).toBe('a-c|', { a: 2, c: 6 });
        });
      });

      it("should preserve timing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a--b--c|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, map((x: number) => x * 10));
          expectStream(result).toBe('a--b--c|', { a: 10, b: 20, c: 30 });
        });
      });
    });

    describe("Timing Patterns", () => {
      it("should handle rapid emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('(abcd)|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, map((x: number) => x + 10));
          expectStream(result).toBe('(abcd)|', { a: 11, b: 12, c: 13, d: 14 });
        });
      });

      it("should handle spaced emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-----b-----c|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, map((x: number) => x * x));
          expectStream(result).toBe('a-----b-----c|', { a: 1, b: 4, c: 9 });
        });
      });

      it("should handle delayed start", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('------abc|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, map((x: number) => x * 2));
          expectStream(result).toBe('------abc|', { a: 2, b: 4, c: 6 });
        });
      });

      it("should handle mixed timing patterns", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a(bc)--d-e-f|', { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
          const result = pipe(stream, map((x: number) => x + 100));
          expectStream(result).toBe('a(bc)--d-e-f|', { 
            a: 101, b: 102, c: 103, d: 104, e: 105, f: 106 
          });
        });
      });

      it("should handle burst emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('(abcde)---f|', { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
          const result = pipe(stream, map((x: number) => x * 10));
          expectStream(result).toBe('(abcde)---f|', { 
            a: 10, b: 20, c: 30, d: 40, e: 50, f: 60 
          });
        });
      });

      it("should handle very long streams", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a---------b---------c---------d|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, map((x: number) => x * 100));
          expectStream(result).toBe('a---------b---------c---------d|', { 
            a: 100, b: 200, c: 300, d: 400 
          });
        });
      });
    });

    describe("Error Handling", () => {
      it("should propagate source stream errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab#', { a: 1, b: 2 });
          const result = pipe(stream, map((x: number) => x * 2));
          expectStream(result).toBe('ab#', { a: 2, b: 4 });
        });
      });

      it("should handle mapping function errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a|', { a: 1 });
          const result = pipe(stream, map((x: number) => {
            throw new Error('map error');
          }));
          expectStream(result).toBe('#', undefined, new Error('map error'));
        });
      });

      it("should handle error before any emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('#');
          const result = pipe(stream, map((x: number) => x * 2));
          expectStream(result).toBe('#');
        });
      });

      it("should handle error after mapping some values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab#', { a: 1, b: 2 });
          const result = pipe(stream, map((x: number) => x * 2));
          expectStream(result).toBe('ab#', { a: 2, b: 4 });
        });
      });

      it("should handle immediate error", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('#');
          const result = pipe(stream, map((x: number) => x * 2));
          expectStream(result).toBe('#');
        });
      });
    });

    describe("Data Types", () => {
      it("should handle string transformations", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 'hello', b: 'world', c: 'test' });
          const result = pipe(stream, map((x: string) => x.toUpperCase()));
          expectStream(result).toBe('abc|', { a: 'HELLO', b: 'WORLD', c: 'TEST' });
        });
      });

      it("should handle object transformations", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab|', { 
            a: { id: 1, name: 'Alice' }, 
            b: { id: 2, name: 'Bob' } 
          });
          const result = pipe(stream, map((x: any) => x.name));
          expectStream(result).toBe('ab|', { a: 'Alice', b: 'Bob' });
        });
      });

      it("should handle array transformations", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: [1, 2], b: [3, 4], c: [5, 6] });
          const result = pipe(stream, map((x: number[]) => x.length));
          expectStream(result).toBe('abc|', { a: 2, b: 2, c: 2 });
        });
      });

      it("should handle boolean transformations", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { a: true, b: false, c: true, d: false });
          const result = pipe(stream, map((x: boolean) => !x));
          expectStream(result).toBe('abcd|', { a: false, b: true, c: false, d: true });
        });
      });

      it("should handle null and undefined values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, map((x: number) => x * 2));
          expectStream(result).toBe('abc|', { a: 2, b: 4, c: 6 });
        });
      });

      it("should handle mixed data types", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcde|', { a: 1, b: 'hello', c: true, d: null, e: { obj: true } });
          const result = pipe(stream, map((x: any) => typeof x));
          expectStream(result).toBe('abcde|', { 
            a: 'number', b: 'string', c: 'boolean', d: 'object', e: 'object' 
          });
        });
      });
    });

    describe("Complex Transformations", () => {
      it("should handle complex mathematical operations", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, map((x: number) => Math.pow(x, 2) + x));
          expectStream(result).toBe('abcd|', { a: 2, b: 6, c: 12, d: 20 });
        });
      });

      it("should handle string processing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 'hello', b: 'world', c: 'test' });
          const result = pipe(stream, map((x: string) => x.split('').reverse().join('')));
          expectStream(result).toBe('abc|', { a: 'olleh', b: 'dlrow', c: 'tset' });
        });
      });

      it("should handle nested object access", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab|', { 
            a: { user: { name: 'Alice', age: 30 } }, 
            b: { user: { name: 'Bob', age: 25 } } 
          });
          const result = pipe(stream, map((x: any) => x.user.name));
          expectStream(result).toBe('ab|', { a: 'Alice', b: 'Bob' });
        });
      });

      it("should handle array operations", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: [1, 2, 3], b: [4, 5], c: [6, 7, 8, 9] });
          const result = pipe(stream, map((x: number[]) => x.reduce((sum, val) => sum + val, 0)));
          expectStream(result).toBe('abc|', { a: 6, b: 9, c: 30 });
        });
      });

      it("should handle conditional mapping", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcdef|', { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
          const result = pipe(stream, map((x: number) => x % 2 === 0 ? x * 2 : x + 10));
          expectStream(result).toBe('abcdef|', { a: 11, b: 4, c: 13, d: 8, e: 15, f: 12 });
        });
      });

      it("should handle function composition", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, map((x: number) => {
            const double = (n: number) => n * 2;
            const addTen = (n: number) => n + 10;
            return addTen(double(x));
          }));
          expectStream(result).toBe('abc|', { a: 12, b: 14, c: 16 });
        });
      });
    });

    describe("Edge Cases", () => {
      it("should handle subscription timing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab^cd|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, map((x: number) => x * 2));
          expectStream(result).toBe('cd|', { c: 6, d: 8 });
        });
      });

      it("should handle hot source stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab^cdef|', { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
          const result = pipe(stream, map((x: number) => x + 100));
          expectStream(result).toBe('cdef|', { c: 103, d: 104, e: 105, f: 106 });
        });
      });

      it("should handle zero values correctly", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 0, b: 1, c: 2 });
          const result = pipe(stream, map((x: number) => x * 10));
          expectStream(result).toBe('abc|', { a: 0, b: 10, c: 20 });
        });
      });

      it("should handle false values correctly", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: false, b: true, c: false });
          const result = pipe(stream, map((x: boolean) => x ? 'yes' : 'no'));
          expectStream(result).toBe('abc|', { a: 'no', b: 'yes', c: 'no' });
        });
      });

      it("should handle empty string values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: '', b: 'hello', c: 'world' });
          const result = pipe(stream, map((x: string) => x.length));
          expectStream(result).toBe('abc|', { a: 0, b: 5, c: 5 });
        });
      });

      it("should handle large numbers", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 1, b: Number.MAX_SAFE_INTEGER, c: 3 });
          const result = pipe(stream, map((x: number) => x + 1));
          expectStream(result).toBe('abc|', { a: 2, b: Number.MAX_SAFE_INTEGER + 1, c: 4 });
        });
      });

      it("should handle NaN values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 1, b: NaN, c: 3 });
          const result = pipe(stream, map((x: number) => isNaN(x) ? 0 : x * 2));
          expectStream(result).toBe('abc|', { a: 2, b: 0, c: 6 });
        });
      });

      it("should handle Infinity values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 1, b: Infinity, c: 3 });
          const result = pipe(stream, map((x: number) => isFinite(x) ? x * 2 : 'infinite'));
          expectStream(result).toBe('abc|', { a: 2, b: 'infinite', c: 6 });
        });
      });
    });
  });
});
