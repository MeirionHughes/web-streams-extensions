import { expect } from "chai";
import { distinctUntilKeyChanged, from, pipe, toArray, throwError } from "../../src/index.js";
import { VirtualTimeScheduler } from "../../src/testing/virtual-tick-scheduler.js";


describe("distinctUntilKeyChanged", () => {
  describe("Real Time", () => {
  it("should filter based on object key with default equality", async () => {
    const input = [
      { id: 1, name: "Alice" },
      { id: 1, name: "Alice Updated" }, // Same id, should be filtered
      { id: 2, name: "Bob" },
      { id: 2, name: "Bob Updated" }, // Same id, should be filtered
      { id: 1, name: "Alice Again" }  // Different id, should pass
    ];
    
    const expected = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
      { id: 1, name: "Alice Again" }
    ];
    
    const result = await toArray(pipe(
      from(input),
      distinctUntilKeyChanged('id')
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should work with string keys", async () => {
    const input = [
      { name: "Alice", age: 25 },
      { name: "Alice", age: 26 }, // Same name, should be filtered
      { name: "Bob", age: 30 },
      { name: "Bob", age: 31 }, // Same name, should be filtered
      { name: "Alice", age: 27 }  // Different name, should pass
    ];
    
    const expected = [
      { name: "Alice", age: 25 },
      { name: "Bob", age: 30 },
      { name: "Alice", age: 27 }
    ];
    
    const result = await toArray(pipe(
      from(input),
      distinctUntilKeyChanged('name')
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should use custom comparison function", async () => {
    const input = [
      { name: "Foo1" },
      { name: "Foo2" }, // Same prefix, should be filtered
      { name: "Bar" },
      { name: "Foo3" }, // Different prefix from "Bar", should pass
      { name: "Foo4" }  // Same prefix as "Foo3", should be filtered
    ];
    
    const expected = [
      { name: "Foo1" },
      { name: "Bar" },
      { name: "Foo3" }
    ];
    
    const result = await toArray(pipe(
      from(input),
      distinctUntilKeyChanged('name', (x, y) => x.substring(0, 3) === y.substring(0, 3))
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should match RxJS example - comparing names", async () => {
    const input = [
      { age: 4, name: 'Foo' },
      { age: 7, name: 'Bar' },
      { age: 5, name: 'Foo' },
      { age: 6, name: 'Foo' }
    ];
    
    const expected = [
      { age: 4, name: 'Foo' },
      { age: 7, name: 'Bar' },
      { age: 5, name: 'Foo' }
    ];
    
    const result = await toArray(pipe(
      from(input),
      distinctUntilKeyChanged('name')
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should match RxJS example - comparing first letters", async () => {
    const input = [
      { age: 4, name: 'Foo1' },
      { age: 7, name: 'Bar' },
      { age: 5, name: 'Foo2' },
      { age: 6, name: 'Foo3' }
    ];
    
    // Note: This should NOT emit the last item since "Foo2" and "Foo3" have same first 3 chars
    const expected = [
      { age: 4, name: 'Foo1' },
      { age: 7, name: 'Bar' },
      { age: 5, name: 'Foo2' }
    ];
    
    const result = await toArray(pipe(
      from(input),
      distinctUntilKeyChanged('name', (x, y) => x.substring(0, 3) === y.substring(0, 3))
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should handle numeric keys", async () => {
    const input = [
      { value: 1, label: "first" },
      { value: 1, label: "second" }, // Same value, filtered
      { value: 2, label: "third" },
      { value: 1, label: "fourth" }  // Different value, passes
    ];
    
    const expected = [
      { value: 1, label: "first" },
      { value: 2, label: "third" },
      { value: 1, label: "fourth" }
    ];
    
    const result = await toArray(pipe(
      from(input),
      distinctUntilKeyChanged('value')
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should handle boolean keys", async () => {
    const input = [
      { active: true, id: 1 },
      { active: true, id: 2 }, // Same active, filtered
      { active: false, id: 3 },
      { active: false, id: 4 }, // Same active, filtered
      { active: true, id: 5 }   // Different active, passes
    ];
    
    const expected = [
      { active: true, id: 1 },
      { active: false, id: 3 },
      { active: true, id: 5 }
    ];
    
    const result = await toArray(pipe(
      from(input),
      distinctUntilKeyChanged('active')
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should handle undefined/null key values", async () => {
    const input = [
      { id: undefined, name: "first" },
      { id: undefined, name: "second" }, // Same undefined, filtered
      { id: null, name: "third" },
      { id: null, name: "fourth" }, // Same null, filtered
      { id: 1, name: "fifth" }
    ];
    
    const expected = [
      { id: undefined, name: "first" },
      { id: null, name: "third" },
      { id: 1, name: "fifth" }
    ];
    
    const result = await toArray(pipe(
      from(input),
      distinctUntilKeyChanged('id')
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should handle empty stream", async () => {
    const result = await toArray(pipe(
      from([]),
      distinctUntilKeyChanged('id')
    ));
    
    expect(result).to.deep.equal([]);
  });

  it("should handle single value", async () => {
    const input = [{ id: 42, name: "test" }];
    
    const result = await toArray(pipe(
      from(input),
      distinctUntilKeyChanged('id')
    ));
    
    expect(result).to.deep.equal(input);
  });

  it("should handle stream errors", async () => {
    try {
      await toArray(pipe(
        throwError(new Error("test error")),
        distinctUntilKeyChanged('id')
      ));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err.message).to.equal("test error");
    }
  });

  it("should handle errors in comparison function", async () => {
    const input = [
      { id: 1, name: "first" },
      { id: 2, name: "second" },
      { id: 3, name: "third" }
    ];
    
    try {
      await toArray(pipe(
        from(input),
        distinctUntilKeyChanged('id', (a, b) => { 
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
      from([
        { id: 1, name: "first" },
        { id: 1, name: "second" },
        { id: 2, name: "third" }
      ]),
      distinctUntilKeyChanged('id')
    );
    
    const reader = stream.getReader();
    const { value } = await reader.read();
    expect(value).to.deep.equal({ id: 1, name: "first" });
    
    // Cancel the stream
    await reader.cancel();
  });

  it("should work with custom highWaterMark", async () => {
    interface TestItem {
      id: number;
      name: string;
    }
    
    const input: TestItem[] = [
      { id: 1, name: "first" },
      { id: 1, name: "second" },
      { id: 2, name: "third" }
    ];
    
    const result = await toArray(pipe(
      from(input),
      distinctUntilKeyChanged<TestItem, 'id'>('id')
    ));
    
    expect(result).to.deep.equal([
      { id: 1, name: "first" },
      { id: 2, name: "third" }
    ]);
  });

  it("should work with nested object keys", async () => {
    const input = [
      { user: { id: 1 }, action: "login" },
      { user: { id: 1 }, action: "click" }, // Same user.id, filtered
      { user: { id: 2 }, action: "login" },
      { user: { id: 1 }, action: "logout" }  // Different user.id, passes
    ];
    
    const expected = [
      { user: { id: 1 }, action: "login" },
      { user: { id: 2 }, action: "login" },
      { user: { id: 1 }, action: "logout" }
    ];
    
    const result = await toArray(pipe(
      from(input),
      distinctUntilKeyChanged('user', (a, b) => a.id === b.id)
    ));
    
    expect(result).to.deep.equal(expected);
  });

  it("should maintain type safety with keyof constraint", async () => {
    interface Person {
      id: number;
      name: string;
      age: number;
    }
    
    const input: Person[] = [
      { id: 1, name: "Alice", age: 25 },
      { id: 1, name: "Alice Updated", age: 26 },
      { id: 2, name: "Bob", age: 30 }
    ];
    
    // These should all compile (valid keys)
    const byId = await toArray(pipe(from(input), distinctUntilKeyChanged('id')));
    const byName = await toArray(pipe(from(input), distinctUntilKeyChanged('name')));
    const byAge = await toArray(pipe(from(input), distinctUntilKeyChanged('age')));
    
    expect(byId.length).to.equal(2);  // "Alice" -> "Bob" (names: "Alice", "Alice Updated", "Bob")
    expect(byName.length).to.equal(3); // All names are different: "Alice", "Alice Updated", "Bob"
    expect(byAge.length).to.equal(3);  // All ages are different: 25, 26, 30
  });
  });

  describe("Virtual Time", () => {
    describe("Basic Behavior", () => {
      it("should filter based on object key with default equality", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcde|', { 
            a: { id: 1, name: 'Alice' },
            b: { id: 1, name: 'Alice2' }, // Same id
            c: { id: 2, name: 'Bob' },
            d: { id: 2, name: 'Bob2' }, // Same id
            e: { id: 1, name: 'Alice3' }
          });
          const result = pipe(stream, distinctUntilKeyChanged('id'));
          expectStream(result).toBe('a-c-e|', { 
            a: { id: 1, name: 'Alice' },
            c: { id: 2, name: 'Bob' },
            e: { id: 1, name: 'Alice3' }
          });
        });
      });

      it("should handle empty stream", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('|');
          const result = pipe(stream, distinctUntilKeyChanged<any, any>('id'));
          expectStream(result).toBe('|');
        });
      });

      it("should handle single value", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a|', { a: { id: 42, name: 'test' } });
          const result = pipe(stream, distinctUntilKeyChanged('id'));
          expectStream(result).toBe('a|', { a: { id: 42, name: 'test' } });
        });
      });

      it("should handle no consecutive duplicates", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { 
            a: { id: 1, name: 'Alice' },
            b: { id: 2, name: 'Bob' },
            c: { id: 3, name: 'Charlie' },
            d: { id: 4, name: 'David' }
          });
          const result = pipe(stream, distinctUntilKeyChanged('id'));
          expectStream(result).toBe('abcd|', { 
            a: { id: 1, name: 'Alice' },
            b: { id: 2, name: 'Bob' },
            c: { id: 3, name: 'Charlie' },
            d: { id: 4, name: 'David' }
          });
        });
      });

      it("should handle all same key values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aaaa|', { a: { id: 1, name: 'Different' } });
          const result = pipe(stream, distinctUntilKeyChanged('id'));
          expectStream(result).toBe('a---|', { a: { id: 1, name: 'Different' } });
        });
      });
    });

    describe("Comparison Function", () => {
      it("should use custom comparison function", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcde|', { 
            a: { name: 'Foo1' },
            b: { name: 'Foo2' }, // Same prefix
            c: { name: 'Bar1' },
            d: { name: 'Foo3' }, // Different prefix from 'Bar'
            e: { name: 'Foo4' }  // Same prefix as 'Foo3'
          });
          const result = pipe(stream, distinctUntilKeyChanged('name', (x: string, y: string) => x.substring(0, 3) === y.substring(0, 3)));
          expectStream(result).toBe('a-cd-|', { 
            a: { name: 'Foo1' },
            c: { name: 'Bar1' },
            d: { name: 'Foo3' }
          });
        });
      });

      it("should handle comparison function returning always true", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcd|', { 
            a: { value: 1 }, 
            b: { value: 2 }, 
            c: { value: 3 }, 
            d: { value: 4 } 
          });
          const result = pipe(stream, distinctUntilKeyChanged('value', (x: any, y: any) => true));
          expectStream(result).toBe('a---|', { a: { value: 1 } });
        });
      });

      it("should handle comparison function returning always false", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aaaa|', { a: { value: 1 } });
          const result = pipe(stream, distinctUntilKeyChanged('value', (x: any, y: any) => false));
          expectStream(result).toBe('aaaa|', { a: { value: 1 } });
        });
      });

      it("should handle nested object comparison", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcde|', { 
            a: { user: { id: 1, role: 'admin' } },
            b: { user: { id: 1, role: 'user' } }, // Same id
            c: { user: { id: 2, role: 'admin' } },
            d: { user: { id: 2, role: 'guest' } }, // Same id
            e: { user: { id: 1, role: 'admin' } }
          });
          const result = pipe(stream, distinctUntilKeyChanged('user', (x: any, y: any) => x.id === y.id));
          expectStream(result).toBe('a-c-e|', { 
            a: { user: { id: 1, role: 'admin' } },
            c: { user: { id: 2, role: 'admin' } },
            e: { user: { id: 1, role: 'admin' } }
          });
        });
      });

      it("should handle complex comparison logic", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcdef|', { 
            a: { score: 85 },
            b: { score: 87 }, // Diff < 5, considered same
            c: { score: 92 }, // Diff >= 5, different
            d: { score: 94 }, // Diff < 5, considered same
            e: { score: 75 }, // Diff >= 5, different
            f: { score: 77 }  // Diff < 5, considered same
          });
          const result = pipe(stream, distinctUntilKeyChanged('score', (x: number, y: number) => Math.abs(x - y) < 5));
          expectStream(result).toBe('a-c-e-|', { 
            a: { score: 85 },
            c: { score: 92 },
            e: { score: 75 }
          });
        });
      });
    });

    describe("Key Types", () => {
      it("should handle string keys", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcde|', { 
            a: { name: 'Alice', age: 25 },
            b: { name: 'Alice', age: 26 }, // Same name
            c: { name: 'Bob', age: 30 },
            d: { name: 'Bob', age: 31 }, // Same name
            e: { name: 'Alice', age: 27 }
          });
          const result = pipe(stream, distinctUntilKeyChanged('name'));
          expectStream(result).toBe('a-c-e|', { 
            a: { name: 'Alice', age: 25 },
            c: { name: 'Bob', age: 30 },
            e: { name: 'Alice', age: 27 }
          });
        });
      });

      it("should handle numeric keys", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcde|', { 
            a: { value: 1, label: 'first' },
            b: { value: 1, label: 'second' }, // Same value
            c: { value: 2, label: 'third' },
            d: { value: 2, label: 'fourth' }, // Same value
            e: { value: 1, label: 'fifth' }
          });
          const result = pipe(stream, distinctUntilKeyChanged('value'));
          expectStream(result).toBe('a-c-e|', { 
            a: { value: 1, label: 'first' },
            c: { value: 2, label: 'third' },
            e: { value: 1, label: 'fifth' }
          });
        });
      });

      it("should handle boolean keys", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcde|', { 
            a: { active: true, id: 1 },
            b: { active: true, id: 2 }, // Same active
            c: { active: false, id: 3 },
            d: { active: false, id: 4 }, // Same active
            e: { active: true, id: 5 }
          });
          const result = pipe(stream, distinctUntilKeyChanged('active'));
          expectStream(result).toBe('a-c-e|', { 
            a: { active: true, id: 1 },
            c: { active: false, id: 3 },
            e: { active: true, id: 5 }
          });
        });
      });

      it("should handle null and undefined keys", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcde|', { 
            a: { id: undefined, name: 'first' },
            b: { id: undefined, name: 'second' }, // Same undefined
            c: { id: null, name: 'third' },
            d: { id: null, name: 'fourth' }, // Same null
            e: { id: 1, name: 'fifth' }
          });
          const result = pipe(stream, distinctUntilKeyChanged('id'));
          expectStream(result).toBe('a-c-e|', { 
            a: { id: undefined, name: 'first' },
            c: { id: null, name: 'third' },
            e: { id: 1, name: 'fifth' }
          });
        });
      });

      it("should handle special number values", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcdef|', { 
            a: { value: 1, label: 'first' },
            b: { value: 1, label: 'second' }, // Same value, filtered
            c: { value: 2, label: 'third' },
            d: { value: 2, label: 'fourth' }, // Same value, filtered
            e: { value: 3, label: 'fifth' },
            f: { value: 0, label: 'zero' }
          });
          const result = pipe(stream, distinctUntilKeyChanged('value'));
          expectStream(result).toBe('a-c-ef|', { 
            a: { value: 1, label: 'first' },
            c: { value: 2, label: 'third' },
            e: { value: 3, label: 'fifth' },
            f: { value: 0, label: 'zero' }
          });
        });
      });
    });

    describe("Timing Patterns", () => {
      it("should preserve timing for non-consecutive key duplicates", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-b-c-b-d|', { 
            a: { id: 1, name: 'Alice' },
            b: { id: 1, name: 'Alice2' }, // Same id as a
            c: { id: 2, name: 'Bob' },
            d: { id: 3, name: 'Charlie' }
          });
          const result = pipe(stream, distinctUntilKeyChanged('id'));
          expectStream(result).toBe('a---c-b-d|', { 
            a: { id: 1, name: 'Alice' },
            c: { id: 2, name: 'Bob' },
            b: { id: 1, name: 'Alice2' },
            d: { id: 3, name: 'Charlie' }
          });
        });
      });

      it("should handle grouped emissions", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('(abc)(def)|', { 
            a: { type: 'user', id: 1 },
            b: { type: 'user', id: 2 }, // Same type
            c: { type: 'admin', id: 3 },
            d: { type: 'admin', id: 4 }, // Same type
            e: { type: 'guest', id: 5 },
            f: { type: 'guest', id: 6 } // Same type
          });
          const result = pipe(stream, distinctUntilKeyChanged('type'));
          expectStream(result).toBe('(a-c)(--e)|', { 
            a: { type: 'user', id: 1 },
            c: { type: 'admin', id: 3 },
            e: { type: 'guest', id: 5 }
          });
        });
      });

      it("should handle spaced consecutive key duplicates", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('a-a-a-b-b-b|', { 
            a: { category: 'A', value: 1 },
            b: { category: 'B', value: 2 }
          });
          const result = pipe(stream, distinctUntilKeyChanged('category'));
          expectStream(result).toBe('a-----b----|', { 
            a: { category: 'A', value: 1 },
            b: { category: 'B', value: 2 }
          });
        });
      });

      it("should handle mixed timing patterns", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aa-b--cc-d|', { 
            a: { status: 'pending', id: 1 },
            b: { status: 'active', id: 2 },
            c: { status: 'active', id: 3 }, // Same status as b
            d: { status: 'complete', id: 4 }
          });
          const result = pipe(stream, distinctUntilKeyChanged('status'));
          expectStream(result).toBe('a--b-----d|', { 
            a: { status: 'pending', id: 1 },
            b: { status: 'active', id: 2 },
            d: { status: 'complete', id: 4 }
          });
        });
      });

      it("should handle rapid key changes", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcdefgh|', { 
            a: { priority: 1 },
            b: { priority: 2 },
            c: { priority: 1 },
            d: { priority: 3 },
            e: { priority: 1 },
            f: { priority: 2 },
            g: { priority: 3 },
            h: { priority: 1 }
          });
          const result = pipe(stream, distinctUntilKeyChanged('priority'));
          expectStream(result).toBe('abcdefgh|', { 
            a: { priority: 1 },
            b: { priority: 2 },
            c: { priority: 1 },
            d: { priority: 3 },
            e: { priority: 1 },
            f: { priority: 2 },
            g: { priority: 3 },
            h: { priority: 1 }
          });
        });
      });
    });

    describe("Error Handling", () => {
      it("should propagate source errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ab#', { a: { id: 1 }, b: { id: 2 } });
          const result = pipe(stream, distinctUntilKeyChanged('id'));
          expectStream(result).toBe('ab#', { a: { id: 1 }, b: { id: 2 } });
        });
      });

      it("should handle error before key duplicates", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('#');
          const result = pipe(stream, distinctUntilKeyChanged<any, any>('id'));
          expectStream(result).toBe('#');
        });
      });

      it("should handle error after filtering key duplicates", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aab#', { a: { id: 1 }, b: { id: 2 } });
          const result = pipe(stream, distinctUntilKeyChanged('id'));
          expectStream(result).toBe('a-b#', { a: { id: 1 }, b: { id: 2 } });
        });
      });

      it("should handle comparison function errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { 
            a: { value: 1 }, 
            b: { value: 2 }, 
            c: { value: 3 } 
          });
          const result = pipe(stream, distinctUntilKeyChanged('value', (x: number, y: number) => {
            if (y === 2) throw new Error('Compare error');
            return x === y;
          }));
          expectStream(result).toBe('a#', { a: { value: 1 } }, new Error('Compare error'));
        });
      });

      it("should handle key access errors", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abc|', { 
            a: { id: 1 }, 
            b: null, // Will cause error when accessing 'id'
            c: { id: 3 } 
          });
          const result = pipe(stream, distinctUntilKeyChanged('id'));
          expectStream(result).toBe('a#', { a: { id: 1 } }, new Error('Expected runtime error')).throws(err => {
            expect(err.cause).to.be.instanceOf(Error);
            const cause = err.cause as Error;
            expect(cause.message).to.satisfy((msg: string) => {
              // Browser-agnostic check for property access error on null
              return (
                msg.includes('null') || 
                msg.includes('properties') || 
                msg.includes('object')
              );
            });
          });
        });
      });
    });

    describe("Edge Cases", () => {
      it("should handle many consecutive key duplicates", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aaaaaaaaaa|', { a: { category: 'same' } });
          const result = pipe(stream, distinctUntilKeyChanged('category'));
          expectStream(result).toBe('a---------|', { a: { category: 'same' } });
        });
      });

      it("should handle alternating key pattern", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('ababababab|', { 
            a: { type: 'A' }, 
            b: { type: 'B' } 
          });
          const result = pipe(stream, distinctUntilKeyChanged('type'));
          expectStream(result).toBe('ababababab|', { 
            a: { type: 'A' }, 
            b: { type: 'B' } 
          });
        });
      });

      it("should handle subscription timing", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aabbccdd|', { 
            a: { status: 1 }, 
            b: { status: 2 }, 
            c: { status: 3 }, 
            d: { status: 4 } 
          });
          const result = pipe(stream, distinctUntilKeyChanged('status'));
          expectStream(result).toBe('a-b-c-d-|', { 
            a: { status: 1 },
            b: { status: 2 },
            c: { status: 3 }, 
            d: { status: 4 } 
          });
        });
      });

      it("should handle hot stream pattern", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aabbcc|', { 
            a: { level: 1 }, 
            b: { level: 2 }, 
            c: { level: 3 } 
          });
          const result = pipe(stream, distinctUntilKeyChanged('level'));
          expectStream(result).toBe('a-b-c-|', { 
            a: { level: 1 },
            b: { level: 2 }, 
            c: { level: 3 } 
          });
        });
      });

      it("should handle consecutive key duplicates across subscription", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aaaaabb|', { 
            a: { priority: 1 }, 
            b: { priority: 2 } 
          });
          const result = pipe(stream, distinctUntilKeyChanged('priority'));
          expectStream(result).toBe('a----b-|', { 
            a: { priority: 1 },
            b: { priority: 2 } 
          });
        });
      });

      it("should handle complex key patterns", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('aab-b-cccd|', { 
            a: { grade: 'A' }, 
            b: { grade: 'B' }, 
            c: { grade: 'C' }, 
            d: { grade: 'D' } 
          });
          const result = pipe(stream, distinctUntilKeyChanged('grade'));
          expectStream(result).toBe('a-b---c--d|', { 
            a: { grade: 'A' }, 
            b: { grade: 'B' }, 
            c: { grade: 'C' }, 
            d: { grade: 'D' } 
          });
        });
      });
    });

    describe("Advanced Scenarios", () => {
      it("should handle deep key extraction", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('abcde|', { 
            a: { meta: { user: { role: 'admin' } } },
            b: { meta: { user: { role: 'admin' } } }, // Same meta object
            c: { meta: { user: { role: 'user' } } },
            d: { meta: { user: { role: 'user' } } }, // Same meta object
            e: { meta: { user: { role: 'guest' } } }
          });
          const result = pipe(stream, distinctUntilKeyChanged('meta', (x: any, y: any) => x.user.role === y.user.role));
          expectStream(result).toBe('a-c-e|', { 
            a: { meta: { user: { role: 'admin' } } },
            c: { meta: { user: { role: 'user' } } },
            e: { meta: { user: { role: 'guest' } } }
          });
        });
      });

      it("should handle performance with many objects", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const values = {};
          const marble = Array(10).fill(0).map((_, i) => {
            const key = String.fromCharCode(97 + i); // a-j
            values[key] = { category: i % 3, index: i }; // Categories 0, 1, 2 cycling
            return key;
          }).join('');
          
          const stream = cold(`${marble}|`, values);
          const result = pipe(stream, distinctUntilKeyChanged<any, any>('category'));
          // Should emit: a(cat:0), b(cat:1), c(cat:2), d(cat:0), e(cat:1), f(cat:2), g(cat:0), h(cat:1), i(cat:2), j(cat:0)
          expectStream(result).toBe('abcdefghij|', values);
        });
      });

      it("should handle burst with key groups", async () => {
        const scheduler = new VirtualTimeScheduler();
        await scheduler.run(async ({ cold, expectStream }) => {
          const stream = cold('(abc)(def)(ghi)|', { 
            a: { team: 'red', player: 1 },
            b: { team: 'red', player: 2 }, // Same team
            c: { team: 'blue', player: 3 },
            d: { team: 'blue', player: 4 }, // Same team
            e: { team: 'green', player: 5 },
            f: { team: 'green', player: 6 }, // Same team
            g: { team: 'red', player: 7 },
            h: { team: 'red', player: 8 }, // Same team
            i: { team: 'yellow', player: 9 }
          });
          const result = pipe(stream, distinctUntilKeyChanged('team'));
          expectStream(result).toBe('(a-c)(--e)(g--i)|', { 
            a: { team: 'red', player: 1 },
            c: { team: 'blue', player: 3 },
            e: { team: 'green', player: 5 },
            g: { team: 'red', player: 7 },
            i: { team: 'yellow', player: 9 }
          });
        });
      });
    });
  });
});
