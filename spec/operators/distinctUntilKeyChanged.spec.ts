import { expect } from "chai";
import { distinctUntilKeyChanged, from, pipe, toArray, throwError } from "../../src/index.js";

describe("distinctUntilKeyChanged", () => {
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
