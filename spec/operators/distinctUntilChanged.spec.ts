import { expect } from "chai";
import { distinctUntilChanged, from, pipe, toArray, throwError } from "../../src/index.js";
import { VirtualTimeScheduler } from "../../src/testing/virtual-tick-scheduler.js";


describe("distinctUntilChanged", () => {
  describe("Real Time", () => {
  it("should filter out consecutive duplicates", async () => {
    const input = [1, 1, 2, 2, 2, 3, 3, 1, 1];
    const expected = [1, 2, 3, 1];
    
    const result = await toArray(pipe(
      from(input),
      distinctUntilChanged()
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should use custom comparison function", async () => {
    const input = [
      { id: 1, name: "a" },
      { id: 1, name: "b" }, // Same id, should be filtered
      { id: 2, name: "c" },
      { id: 2, name: "d" }, // Same id, should be filtered
      { id: 1, name: "e" }  // Different id, should pass
    ];
    
    const expected = [
      { id: 1, name: "a" },
      { id: 2, name: "c" },
      { id: 1, name: "e" }
    ];
    
    const result = await toArray(pipe(
      from(input),
      distinctUntilChanged((a, b) => a.id === b.id)
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should emit first value even if undefined", async () => {
    const input = [undefined, undefined, 1, 1, 2];
    const expected = [undefined, 1, 2];
    
    const result = await toArray(pipe(
      from(input),
      distinctUntilChanged()
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should handle empty stream", async () => {
    const result = await toArray(pipe(
      from([]),
      distinctUntilChanged()
    ));
    
    expect(result).to.deep.equal([]);
  });

  it("should handle single value", async () => {
    const result = await toArray(pipe(
      from([42]),
      distinctUntilChanged()
    ));
    
    expect(result).to.deep.equal([42]);
  });

  it("should handle stream errors", async () => {
    try {
      await toArray(pipe(
        throwError(new Error("test error")),
        distinctUntilChanged()
      ));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err.message).to.equal("test error");
    }
  });

  it("should handle errors in comparison function", async () => {
    try {
      await toArray(pipe(
        from([1, 2, 3]),
        distinctUntilChanged((a, b) => { 
          if (a === 2) throw new Error("compare error");
          return a === b;
        })
      ));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err.message).to.equal("compare error");
    }
  });

  it("should handle cancellation properly", async () => {
    const stream = pipe(
      from([1, 1, 2, 2, 3]),
      distinctUntilChanged()
    );
    
    const reader = stream.getReader();
    const { value } = await reader.read();
    expect(value).to.equal(1);
    
    // Cancel the stream
    await reader.cancel();
  });

  it("should work with custom highWaterMark", async () => {
    const distinctOp = distinctUntilChanged();
    const result = await toArray(pipe(
      from([1, 1, 2, 2, 3]),
      (src) => distinctOp(src, { highWaterMark: 1 })
    ));
    expect(result).to.deep.equal([1, 2, 3]);
  });

  it("should handle null values", async () => {
    const result = await toArray(pipe(
      from([null, null, 1, 1, null]),
      distinctUntilChanged()
    ));
    expect(result).to.deep.equal([null, 1, null]);
  });

  it("should handle boolean values", async () => {
    const result = await toArray(pipe(
      from([true, true, false, false, true]),
      distinctUntilChanged()
    ));
    expect(result).to.deep.equal([true, false, true]);
  });

  it("should handle string values", async () => {
    const result = await toArray(pipe(
      from(['a', 'a', 'b', 'b', 'c']),
      distinctUntilChanged()
    ));
    expect(result).to.deep.equal(['a', 'b', 'c']);
  });

  it("should handle complex comparison logic", async () => {
    const result = await toArray(pipe(
      from([1, 2, 4, 8, 16]),
      distinctUntilChanged((a, b) => Math.abs(a - b) < 2) // Consider consecutive if diff < 2
    ));
    expect(result).to.deep.equal([1, 4, 8, 16]);
  });

  it("should work with different data types", async () => {
    const result = await toArray(pipe(
      from(['1', '1', 1, 1, '2']),
      distinctUntilChanged()
    ));
    expect(result).to.deep.equal(['1', 1, '2']);
  });
  });

  describe("Virtual Time", () => {
    describe("Basic Behavior", () => {
      it("should filter out consecutive duplicates", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aabbccdaa|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('a-b-c-da-|', { a: 1, b: 2, c: 3, d: 4 });
        });
      });

      it("should emit first value", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a|', { a: 1 });
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('a|', { a: 1 });
        });
      });

      it("should handle no consecutive duplicates", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('abcd|', { a: 1, b: 2, c: 3, d: 4 });
        });
      });

      it("should handle all same values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aaaa|', { a: 1 });
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('a---|', { a: 1 });
        });
      });

      it("should handle empty stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('|');
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('|');
        });
      });
    });

    describe("Comparison Function", () => {
      it("should use custom comparison function", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcde|', { 
            a: { id: 1, name: 'Alice' },
            b: { id: 1, name: 'Alice2' }, // Same id
            c: { id: 2, name: 'Bob' },
            d: { id: 2, name: 'Bob2' }, // Same id
            e: { id: 1, name: 'Alice3' }
          });
          const result = pipe(stream, distinctUntilChanged((x: any, y: any) => x.id === y.id));
          expectStream(result).toBe('a-c-e|', { 
            a: { id: 1, name: 'Alice' },
            c: { id: 2, name: 'Bob' },
            e: { id: 1, name: 'Alice3' }
          });
        });
      });

      it("should handle comparison function returning always true", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, distinctUntilChanged((x: any, y: any) => true));
          expectStream(result).toBe('a---|', { a: 1 });
        });
      });

      it("should handle comparison function returning always false", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aaaa|', { a: 1 });
          const result = pipe(stream, distinctUntilChanged((x: any, y: any) => false));
          expectStream(result).toBe('aaaa|', { a: 1 });
        });
      });

      it("should handle complex comparison logic", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcdef|', { a: 1, b: 2, c: 4, d: 8, e: 16, f: 32 });
          const result = pipe(stream, distinctUntilChanged((x: number, y: number) => Math.abs(x - y) < 3));
          expectStream(result).toBe('a-cdef|', { a: 1, c: 4, d: 8, e: 16, f: 32 });
        });
      });

      it("should handle comparison with object properties", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcdef|', { 
            a: { type: 'user', value: 1 },
            b: { type: 'user', value: 2 },
            c: { type: 'admin', value: 3 },
            d: { type: 'admin', value: 4 },
            e: { type: 'guest', value: 5 },
            f: { type: 'guest', value: 6 }
          });
          const result = pipe(stream, distinctUntilChanged((x: any, y: any) => x.type === y.type));
          expectStream(result).toBe('a-c-e-|', { 
            a: { type: 'user', value: 1 },
            c: { type: 'admin', value: 3 },
            e: { type: 'guest', value: 5 }
          });
        });
      });
    });

    describe("Timing Patterns", () => {
      it("should preserve timing for non-consecutive duplicates", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-a-b-b-a|', { a: 1, b: 2 });
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('a---b---a|', { a: 1, b: 2 });
        });
      });

      it("should handle grouped emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('(aab)(bcc)d|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('(a-b)(-c-)d|', { a: 1, b: 2, c: 3, d: 4 });
        });
      });

      it("should handle rapid consecutive duplicates", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aaabbbbcccc|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('a--b---c---|', { a: 1, b: 2, c: 3 });
        });
      });

      it("should handle spaced consecutive duplicates", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-a-a-b-b-b|', { a: 1, b: 2 });
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('a-----b----|', { a: 1, b: 2 });
        });
      });

      it("should handle mixed timing patterns", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aa-b--cc-d|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('a--b--c--d|', { a: 1, b: 2, c: 3, d: 4 });
        });
      });

      it("should handle late consecutive duplicates", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc------ccc|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('abc---------|', { a: 1, b: 2, c: 3 });
        });
      });
    });

    describe("Error Handling", () => {
      it("should propagate source errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aa#', { a: 1 });
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('a-#', { a: 1 });
        });
      });

      it("should handle error before duplicates", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('#');
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('#');
        });
      });

      it("should handle error after filtering duplicates", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aab#', { a: 1, b: 2 });
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('a-b#', { a: 1, b: 2 });
        });
      });

      it("should handle comparison function errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, distinctUntilChanged((x: number, y: number) => {
            if (y === 2) throw new Error('Compare error');
            return x === y;
          }));
          expectStream(result).toBe('a#', { a: 1 }, new Error('Compare error'));
        });
      });

      it("should handle comparison function error with timing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a--b--c|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, distinctUntilChanged((x: number, y: number) => {
            if (y === 2) throw new Error('Compare error');
            return x === y;
          }));
          expectStream(result).toBe('a--#', { a: 1 }, new Error('Compare error'));
        });
      });
    });

    describe("Data Types", () => {
      it("should handle string values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aabbccaa|', { a: 'hello', b: 'world', c: 'test' });
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('a-b-c-a-|', { a: 'hello', b: 'world', c: 'test' });
        });
      });

      it("should handle boolean values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aabbaa|', { a: true, b: false });
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('a-b-a-|', { a: true, b: false });
        });
      });

      it("should handle null and undefined", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aabbccaa|', { a: null, b: undefined, c: 0 });
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('a-b-c-a-|', { a: null, b: undefined, c: 0 });
        });
      });

      it("should handle mixed data types", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aabbccdd|', { 
            a: 'string' as any, 
            b: 42 as any, 
            c: true as any, 
            d: null as any 
          });
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('a-b-c-d-|', { 
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
          const obj = { id: 1 };
          const stream = cold('aabba|', { a: obj as any, b: { id: 2 } as any });
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('a-b-a|', { a: obj as any, b: { id: 2 } as any });
        });
      });

      it("should handle array values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const arr1 = [1, 2];
          const arr2 = [3, 4];
          const stream = cold('aabba|', { a: arr1 as any, b: arr2 as any });
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('a-b-a|', { a: arr1 as any, b: arr2 as any });
        });
      });
    });

    describe("Edge Cases", () => {
      it("should handle many consecutive duplicates", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aaaaaaaaaa|', { a: 1 });
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('a---------|', { a: 1 });
        });
      });

      it("should handle alternating pattern", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ababababab|', { a: 1, b: 2 });
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('ababababab|', { a: 1, b: 2 });
        });
      });

      it("should handle special number values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aabbccdd|', { 
            a: 1/0 as any, 
            b: -1/0 as any, 
            c: 0 as any, 
            d: 1 as any 
          });
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('a-b-c-d-|', { 
            a: 1/0 as any, 
            b: -1/0 as any, 
            c: 0 as any, 
            d: 1 as any 
          });
        });
      });

      it("should handle subscription timing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aabbccdd|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('a-b-c-d-|', { a: 1, b: 2, c: 3, d: 4 });
        });
      });

      it("should handle hot stream pattern", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aabbcc|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('a-b-c-|', { a: 1, b: 2, c: 3 });
        });
      });

      it("should handle consecutive duplicates across subscription", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aaaaabb|', { a: 1, b: 2 });
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('a----b-|', { a: 1, b: 2 });
        });
      });

      it("should handle complex consecutive patterns", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aab-b-cccd|', { a: 1, b: 2, c: 3, d: 4 });
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('a-b---c--d|', { a: 1, b: 2, c: 3, d: 4 });
        });
      });
    });

    describe("Performance Scenarios", () => {
      it("should handle burst of consecutive duplicates", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('(aaaa)(bbbb)(cccc)|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('(a---)(b---)(c---)|', { a: 1, b: 2, c: 3 });
        });
      });

      it("should handle complex pattern with groups", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('(abc)(bcd)(cde)|', { a: 1, b: 2, c: 3, d: 4, e: 5 });
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('(abc)(bcd)(cde)|', { a: 1, b: 2, c: 3, d: 4, e: 5 });
        });
      });

      it("should handle long sequence with pattern", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aabbccaabbcc|', { a: 1, b: 2, c: 3 });
          const result = pipe(stream, distinctUntilChanged());
          expectStream(result).toBe('a-b-c-a-b-c-|', { a: 1, b: 2, c: 3 });
        });
      });
    });
  });
});
