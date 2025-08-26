## Creation

### from\<T>(src: Iterable\<T> | AsyncIterable\<T> | (() => Iterable\<T> | AsyncIterable\<T>) | ReadableLike\<T>): ReadableStream\<T>

Creates a ReadableStream from various input sources. Supports iterables, async iterables, promises, functions returning iterables, and ReadableLike objects.

It will not create an iterator until the resulting stream is read from (lazy evaluation).

```ts
from([1, 2, 3, 4])
from(function*() { yield 1; yield 2; yield 3; yield 4; })
from(async function*() { yield 1; yield 2; yield 3; yield await Promise.resolve(4); })
from(Promise.resolve([1, 2, 3, 4]))
```

### of\<T>(...args: T[]): ReadableStream\<T>

Creates a ReadableStream where the chunks will be the in-order arguments passed to it.

```ts
of(1, "foo", () => "bar", {})
// Emits: 1, "foo", () => "bar", {}
```

### interval(duration: number): ReadableStream\<number>

Creates a ReadableStream that emits incremental numbers at specified intervals, starting immediately.

**Deterministic behavior:**
- **First emission**: Always emits `0` immediately (no delay)
- **Subsequent emissions**: Emits `1, 2, 3, ...` every `duration` milliseconds
- **Infinite stream**: Continues emitting until cancelled or an error occurs
- **Timing**: Uses `setInterval` internally for consistent timing

```ts
// Emit every second starting immediately
const counter = pipe(
  interval(1000), // Emits 0, 1, 2, 3... every second
  take(5)
);
const result = await toArray(counter);
// Timeline: 0ms→0, 1000ms→1, 2000ms→2, 3000ms→3, 4000ms→4
// Result: [0, 1, 2, 3, 4]

// Fast interval for real-time updates
const heartbeat = pipe(
  interval(16), // ~60fps (16.67ms intervals)
  map(frame => ({ frame, timestamp: Date.now() })),
  take(3)
);
// Useful for animations or real-time monitoring
```

### concat\<T>(...streams: ReadableStream\<T>[]): ReadableStream\<T>

Concatenates several streams together in the order given. Each stream is read to completion before moving to the next.

It will not read from the streams until the result stream is read from (lazy evaluation).

```ts
let inputA = [1, 2];
let inputB = [3, 4];
let expected = [1, 2, 3, 4];
let stream = concat(from(inputA), from(inputB));
let result = await toArray(stream);
```

### zip(...sources: ReadableStream\<T>[], selector?: Function): ReadableStream

Combines multiple streams by pairing up values from each stream. Supports heterogeneous types and optional selector functions for transformation.

```ts
// Basic zip - returns tuples
const numbers = from([1, 2, 3]);
const letters = from(['a', 'b', 'c']);
const result = await toArray(zip(numbers, letters));
// Result: [[1, 'a'], [2, 'b'], [3, 'c']]

// With selector function
const combined = await toArray(zip(numbers, letters, (n, l) => `${n}${l}`));
// Result: ['1a', '2b', '3c']

// Three streams with different types
const symbols = from(['!', '?', '.']);
const booleans = from([true, false, true]);
const result = await toArray(zip(
  numbers, 
  letters, 
  symbols, 
  booleans,
  (n, l, s, b) => ({ num: n, letter: l, symbol: s, flag: b })
));
// Result: [
//   { num: 1, letter: 'a', symbol: '!', flag: true },
//   { num: 2, letter: 'b', symbol: '?', flag: false },
//   { num: 3, letter: 'c', symbol: '.', flag: true }
// ]

// Legacy array format (for homogeneous streams)
const streams = [from([1, 2, 3]), from([4, 5, 6]), from([7, 8, 9])];
const result = await toArray(zip(streams));
// Result: [[1, 4, 7], [2, 5, 8], [3, 6, 9]]
```

The stream completes when any of the source streams completes.

### defer\<T>(cb: () => Promise\<ReadableStream\<T>> | ReadableStream\<T>): ReadableStream\<T>

Defers the creation of a ReadableStream until it's actually read from. Useful for lazy initialization.

```ts
let result = await toArray(defer(() => Promise.resolve(from([1, 2, 3, 4]))));
// Result: [1, 2, 3, 4]
```

### empty\<T>(): ReadableStream\<T>

Creates a ReadableStream that immediately completes without emitting any values.

```ts
const result = await toArray(empty());
// Result: []

const typedEmpty = await toArray(empty<number>());
// Result: [] (typed as number[])
```

### throwError\<T>(error: any | (() => any)): ReadableStream\<T>

Creates a ReadableStream that immediately errors with the provided error or error factory function.

```ts
// With direct error
try {
  await toArray(throwError(new Error("Something went wrong")));
} catch (err) {
  console.log(err.message); // "Something went wrong"
}

// With error factory function
const errorFactory = () => new Error(`Error at ${Date.now()}`);
try {
  await toArray(throwError(errorFactory));
} catch (err) {
  console.log(err.message); // "Error at [timestamp]"
}
```

### timer(dueTime: number, interval?: number): ReadableStream\<number>

Creates a ReadableStream that emits after the specified delay. If an interval is provided, continues emitting incrementally at that interval.

**Deterministic behavior:**
- **Single emission**: With only `dueTime`, emits `0` after the specified delay then completes
- **Interval emissions**: With both `dueTime` and `interval`, emits `0, 1, 2, ...` starting after `dueTime`, then every `interval` milliseconds
- **Values**: Always emits incrementing integers starting from 0

```ts
// Single emission after delay
const result = await toArray(timer(1000));
// After 1000ms: [0]

// Interval emissions: first after 500ms, then every 1000ms
const result = await toArray(pipe(timer(500, 1000), take(4)));
// Timeline: 500ms→0, 1500ms→1, 2500ms→2, 3500ms→3
// Result: [0, 1, 2, 3]

// Immediate timer (0ms delay)
const result = await toArray(pipe(timer(0, 100), take(3)));
// Emits immediately, then every 100ms: [0, 1, 2]
```

### range(start: number, count: number): ReadableStream\<number>

Creates a ReadableStream that emits a consecutive sequence of numbers.

**Deterministic behavior:**
- **Start value**: First number emitted is always `start`
- **Count**: Exactly `count` numbers are emitted
- **Sequence**: Numbers increment by 1: `start, start+1, start+2, ..., start+count-1`
- **Empty range**: If `count` is 0, no values are emitted and stream completes immediately

```ts
const result = await toArray(range(5, 4));
// Result: [5, 6, 7, 8] - starts at 5, emits 4 numbers

const result2 = await toArray(range(0, 3));
// Result: [0, 1, 2] - starts at 0, emits 3 numbers

const empty = await toArray(range(100, 0));
// Result: [] - count is 0, so no emissions

// Negative numbers work too
const negative = await toArray(range(-3, 3));
// Result: [-3, -2, -1]
```

### combineLatest\<T>(...sources: ReadableStream\<T>[]): ReadableStream\<T[]>

Combines multiple streams by emitting the latest values from each stream whenever any stream emits.

```ts
const numbers = from([1, 2, 3]);
const letters = from(['a', 'b', 'c']);

const result = await toArray(pipe(
  combineLatest(numbers, letters),
  take(3)
));
// Result: [[1, 'a'], [2, 'b'], [3, 'c']] (simplified - actual timing dependent)
```

### race\<T>(...sources: ReadableStream\<T>[]): ReadableStream\<T>

Creates a stream that mirrors the first source stream to emit a value, cancelling the others.

```ts
const fast = from([1, 2, 3]);
const slow = timer(1000);

const result = await toArray(pipe(race(fast, slow), take(2)));
// Result: [1, 2, 3] (fast stream wins)
```
