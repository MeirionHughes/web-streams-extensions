import { expect } from "chai";
import { from, pipe, toArray, distinct, throwError } from "../../src/index.js";
import { VirtualTimeScheduler } from "../../src/testing/virtual-tick-scheduler.js";


describe("distinct", () => {
  describe("Real Time", () => {
  it("should filter out duplicates", async () => {
    const result = await toArray(pipe(
      from([1, 2, 2, 3, 1, 4, 3]),
      distinct()
    ));
    expect(result).to.deep.equal([1, 2, 3, 4]);
  });

  it("should work with key selector", async () => {
    const result = await toArray(pipe(
      from([
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
        { id: 1, name: 'John Doe' },
        { id: 3, name: 'Bob' }
      ]),
      distinct(person => person.id)
    ));
    expect(result.length).to.equal(3);
    expect(result.map(p => p.id)).to.deep.equal([1, 2, 3]);
  });

  it("should handle empty stream", async () => {
    const result = await toArray(pipe(
      from([]),
      distinct()
    ));
    expect(result).to.deep.equal([]);
  });

  it("should handle single value", async () => {
    const result = await toArray(pipe(
      from([42]),
      distinct()
    ));
    expect(result).to.deep.equal([42]);
  });

  it("should handle stream errors", async () => {
    try {
      await toArray(pipe(
        throwError(new Error("test error")),
        distinct()
      ));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err.message).to.equal("test error");
    }
  });

  it("should handle errors in key selector", async () => {
    try {
      await toArray(pipe(
        from([1, 2, 3]),
        distinct((value) => { 
          if (value === 2) throw new Error("selector error");
          return value;
        })
      ));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err.message).to.equal("selector error");
    }
  });

  it("should handle cancellation properly", async () => {
    const stream = pipe(
      from([1, 2, 3, 4, 5]),
      distinct()
    );
    
    const reader = stream.getReader();
    const { value } = await reader.read();
    expect(value).to.equal(1);
    
    // Cancel the stream
    await reader.cancel();
  });

  it("should work with custom highWaterMark", async () => {
    const distinctOp = distinct();
    const result = await toArray(pipe(
      from([1, 2, 2, 3, 1]),
      (src) => distinctOp(src, { highWaterMark: 1 })
    ));
    expect(result).to.deep.equal([1, 2, 3]);
  });

  it("should handle null and undefined values", async () => {
    const result = await toArray(pipe(
      from([null, undefined, null, 1, undefined, 2]),
      distinct()
    ));
    expect(result).to.deep.equal([null, undefined, 1, 2]);
  });

  it("should handle objects with complex equality", async () => {
    const obj1 = { x: 1 };
    const obj2 = { x: 1 }; // Different object, same content
    const result = await toArray(pipe(
      from([obj1, obj2, obj1]),
      distinct()
    ));
    expect(result).to.deep.equal([obj1, obj2]); // Both objects preserved as they're different references
  });

  it("should handle very large stream efficiently", async () => {
    const largeArray = Array.from({ length: 10000 }, (_, i) => i % 100);
    const result = await toArray(pipe(
      from(largeArray),
      distinct()
    ));
    expect(result.length).to.equal(100);
    expect(result).to.deep.equal(Array.from({ length: 100 }, (_, i) => i));
  });

  it("should work with different data types", async () => {
    const result = await toArray(pipe(
      from(['a', 1, 'a', 2, 1, 'b']),
      distinct()
    ));
    expect(result).to.deep.equal(['a', 1, 2, 'b']);
  });
  });

  describe("Virtual Time", () => {
    describe("Basic Behavior", () => {
      it("should filter out duplicates", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcbac|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, distinct());
          expectStream(result).toBe('abc---|', { a: 1, b: 2, c: 3 });
        });
      });

      it("should handle empty stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('|');
          const result = pipe(stream, distinct());
          expectStream(result).toBe('|');
        });
      });

      it("should handle single value", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a|', { a: 42 });
          const result = pipe(stream, distinct());
          expectStream(result).toBe('a|', { a: 42 });
        });
      });

      it("should handle no duplicates", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, distinct());
          expectStream(result).toBe('abcd|', { a: 1, b: 2, c: 3, d: 4 });
        });
      });

      it("should handle all duplicates", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aaaa|', { a: 1 });
          const result = pipe(stream, distinct());
          expectStream(result).toBe('a---|', { a: 1 });
        });
      });
    });

    describe("Key Selector", () => {
      it("should use key selector for comparison", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { 
            a: { id: 1, name: 'Alice' }, 
            b: { id: 2, name: 'Bob' },
            c: { id: 1, name: 'Alice2' },
            d: { id: 3, name: 'Charlie' }
          });
          const result = pipe(stream, distinct((x: any) => x.id));
          expectStream(result).toBe('ab-d|', { 
            a: { id: 1, name: 'Alice' }, 
            b: { id: 2, name: 'Bob' },
            d: { id: 3, name: 'Charlie' }
          });
        });
      });

      it("should handle null keys from selector", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { a: null, b: undefined, c: null, d: 0 });
          const result = pipe(stream, distinct((x: any) => x));
          expectStream(result).toBe('ab-d|', { a: null, b: undefined, d: 0 });
        });
      });

      it("should handle key selector returning same value", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, distinct((x: number) => 'constant'));
          expectStream(result).toBe('a---|', { a: 1 });
        });
      });

      it("should handle complex key selector logic", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcdef|', { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
          const result = pipe(stream, distinct((x: number) => x % 3));
          expectStream(result).toBe('abc---|', { a: 1, b: 2, c: 3 });
        });
      });

      it("should handle key selector with object properties", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { 
            a: { type: 'user', id: 1 }, 
            b: { type: 'admin', id: 2 },
            c: { type: 'user', id: 3 },
            d: { type: 'guest', id: 4 }
          });
          const result = pipe(stream, distinct((x: any) => x.type));
          expectStream(result).toBe('ab-d|', { 
            a: { type: 'user', id: 1 }, 
            b: { type: 'admin', id: 2 },
            d: { type: 'guest', id: 4 }
          });
        });
      });
    });

    describe("Timing Patterns", () => {
      it("should preserve timing for non-duplicate values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-b-c-b-d|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, distinct());
          expectStream(result).toBe('a-b-c---d|', { a: 1, b: 2, c: 3, d: 4 });
        });
      });

      it("should handle grouped emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('(abc)d(bef)|', { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
          const result = pipe(stream, distinct());
          expectStream(result).toBe('(abc)d(-ef)|', { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
        });
      });

      it("should handle rapid duplicates", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aabbccdd|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, distinct());
          expectStream(result).toBe('a-b-c-d-|', { a: 1, b: 2, c: 3, d: 4 });
        });
      });

      it("should handle spaced duplicates", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a---b---a---c|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, distinct());
          expectStream(result).toBe('a---b-------c|', { a: 1, b: 2, c: 3 });
        });
      });

      it("should handle complex timing patterns", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-b-(ca)--d|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, distinct());
          expectStream(result).toBe('a-b-(c-)--d|', { a: 1, b: 2, c: 3, d: 4 });
        });
      });

      it("should handle late duplicates", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc----------a|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, distinct());
          expectStream(result).toBe('abc-----------|', { a: 1, b: 2, c: 3 });
        });
      });
    });

    describe("Error Handling", () => {
      it("should propagate source errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab#', { a: 1, b: 2 });
          const result = pipe(stream, distinct());
          expectStream(result).toBe('ab#', { a: 1, b: 2 });
        });
      });

      it("should handle error before any duplicates", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('#');
          const result = pipe(stream, distinct());
          expectStream(result).toBe('#');
        });
      });

      it("should handle error after filtering duplicates", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aba#', { a: 1, b: 2 });
          const result = pipe(stream, distinct());
          expectStream(result).toBe('ab-#', { a: 1, b: 2 });
        });
      });

      it("should handle key selector errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, distinct((x: number) => {
            if (x === 2) throw new Error('Selector error');
            return x;
          }));
          expectStream(result).toBe('a#', { a: 1 }, new Error('Selector error'));
        });
      });

      it("should handle key selector error with timing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a--b--c|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, distinct((x: number) => {
            if (x === 2) throw new Error('Selector error');
            return x;
          }));
          expectStream(result).toBe('a--#', { a: 1 }, new Error('Selector error'));
        });
      });
    });

    describe("Data Types", () => {
      it("should handle string values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcbad|', { a: 'hello', b: 'world', c: 'test', d: 'new' });
          const result = pipe(stream, distinct());
          expectStream(result).toBe('abc--d|', { a: 'hello', b: 'world', c: 'test', d: 'new' });
        });
      });

      it("should handle boolean values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcba|', { a: true, b: false, c: true });
          const result = pipe(stream, distinct());
          expectStream(result).toBe('ab---|', { a: true, b: false });
        });
      });

      it("should handle null and undefined", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcabc|', { a: null, b: undefined, c: 0 });
          const result = pipe(stream, distinct());
          expectStream(result).toBe('abc---|', { a: null, b: undefined, c: 0 });
        });
      });

      it("should handle mixed data types", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcdea|', { 
            a: 'string' as any, 
            b: 42 as any, 
            c: true as any, 
            d: null as any, 
            e: 42 as any 
          });
          const result = pipe(stream, distinct());
          expectStream(result).toBe('abcd--|', { 
            a: 'string' as any, 
            b: 42 as any, 
            c: true as any, 
            d: null as any 
          });
        });
      });

      it("should handle object references", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const obj1 = { id: 1 };
          const obj2 = { id: 1 }; // Same content, different reference
          const stream = cold('abca|', { a: obj1 as any, b: obj2 as any, c: obj1 as any });
          const result = pipe(stream, distinct());
          expectStream(result).toBe('ab--|', { a: obj1 as any, b: obj2 as any });
        });
      });

      it("should handle array values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const arr1 = [1, 2];
          const arr2 = [1, 2]; // Same content, different reference
          const stream = cold('abca|', { a: arr1 as any, b: arr2 as any, c: arr1 as any });
          const result = pipe(stream, distinct());
          expectStream(result).toBe('ab--|', { a: arr1 as any, b: arr2 as any });
        });
      });
    });

    describe("Edge Cases", () => {
      it("should handle many duplicates of same value", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aaaaaaaaaa|', { a: 1 });
          const result = pipe(stream, distinct());
          expectStream(result).toBe('a---------|', { a: 1 });
        });
      });

      it("should handle alternating pattern", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ababababab|', { a: 1, b: 2 });
          const result = pipe(stream, distinct());
          expectStream(result).toBe('ab--------|', { a: 1, b: 2 });
        });
      });

      it("should handle special number values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { 
            a: 1/0 as any, 
            b: -1/0 as any, 
            c: 0 as any,
            d: -0 as any 
          });
          const result = pipe(stream, distinct());
          expectStream(result).toBe('abc-|', { 
            a: 1/0 as any, 
            b: -1/0 as any, 
            c: 0 as any
          });
        });
      });

      it("should handle large key space", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const values = {};
          const marble = Array(26).fill(0).map((_, i) => {
            const key = String.fromCharCode(97 + i); // a-z
            values[key] = i;
            return key;
          }).join('');
          
          const stream = cold(`${marble}|`, values);
          const result = pipe(stream, distinct());
          expectStream(result).toBe(`${marble}|`, values);
        });
      });

      it("should handle complex key selector with collisions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcdefgh|', { 
            a: 1, b: 4, c: 7, d: 10, // All % 3 === 1
            e: 2, f: 5, g: 8, h: 11  // All % 3 === 2
          });
          const result = pipe(stream, distinct((x: number) => x % 3));
          expectStream(result).toBe('a---e---|', { a: 1, e: 2 });
        });
      });

      it("should handle subscription timing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcdc|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, distinct());
          expectStream(result).toBe('abcd-|', { a: 1, b: 2, c: 3, d: 4 });
        });
      });

      it("should handle hot stream with late subscription", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abacac|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, distinct());
          expectStream(result).toBe('ab-c--|', { a: 1, b: 2, c: 3 });
        });
      });
    });

    describe("Performance Scenarios", () => {
      it("should handle burst of duplicates", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('(aaaabbbbcccc)|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, distinct());
          expectStream(result).toBe('(abc)|', { a: 1, b: 2, c: 3 });
        });
      });

      it("should handle complex distinct pattern", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-b-(cdc)-e-(afa)|', { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
          const result = pipe(stream, distinct());
          expectStream(result).toBe('a-b-(cd-)-e-(-f-)|', { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
        });
      });

      it("should handle long sequence with few uniques", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ababababab-c-ababab|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, distinct());
          expectStream(result).toBe('ab---------(c)-------|', { a: 1, b: 2, c: 3 });
        });
      });
    });
  });
});
