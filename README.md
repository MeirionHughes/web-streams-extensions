# WebStream Extensions

[![npm version](https://img.shields.io/npm/v/web-streams-extensions.svg)](https://www.npmjs.com/package/web-streams-extensions)
[![Build Status](https://github.com/MeirionHughes/web-streams-extensions/workflows/Tests/badge.svg)](https://github.com/MeirionHughes/web-streams-extensions/actions)
[![codecov](https://codecov.io/gh/MeirionHughes/web-streams-extensions/branch/master/graph/badge.svg)](https://codecov.io/gh/MeirionHughes/web-streams-extensions)

A collection helper methods for WebStreams, inspired by ReactiveExtensions. 

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## Installation

```bash
npm install web-streams-extensions
```

## Usage

### Basic Example

```typescript
import { from, pipe, map, filter, toArray } from 'web-streams-extensions';

// Create a stream from an array and process it
const stream = pipe(
  from([1, 2, 3, 4, 5, 6]),
  filter(x => x % 2 === 0),  // Keep even numbers
  map(x => x * 2)            // Double them
);

const result = await toArray(stream);
console.log(result); // [4, 8, 12]
```

⚠️ReadableStreams are not recoverable. If you start and consume a stream, that instance cannot be reused.  

### Operators 

Operators are functions of the form: 
`type Op<T, R> = (src: ReadableStream<T>) => ReadableStream<R>`
This only requires ReadableStream to be implemented/available with getReader support. 

## API Reference Quick Index

### Creation Functions
- `from()` - Create stream from iterable, async iterable, promise, or function
- `of()` - Create stream from arguments
- `empty()` - Create stream that completes immediately without emitting values
- `throwError()` - Create stream that errors immediately with provided error
- `timer()` - Create stream that emits after delay, optionally with interval
- `range()` - Create stream that emits sequence of numbers
- `interval()` - Create stream that emits numbers at intervals
- `concat()` - Concatenate multiple streams sequentially
- `zip()` - Combine multiple streams with optional selector functions
- `combineLatest()` - Combine latest values from multiple streams
- `race()` - Emit from first source stream to emit
- `defer()` - Defer stream creation until read

### Consuming Functions
- `toArray()` - Collect all values into an array
- `toPromise()` - Get the last emitted value
- `toString()` - Combine all chunks into a string
- `subscribe()` - Subscribe with callbacks for next/complete/error

### Pipe Functions
- `pipe()` - Chain operators together
- `retryPipe()` - Pipe with retry semantics on error

### Transformation Operators
- `map()` - Transform each value (async supported)
- `mapSync()` - Transform each value (sync only, faster)
- `scan()` - Accumulate with intermediate results
- `reduce()` - Accumulate to final result
- `switchMap()` - Map to streams, switch to latest
- `concatMap()` - Map to streams, concatenate sequentially
- `exhaustMap()` - Map to streams, ignore new while active
- `mergeMap()` - Map to stream, concatenate concurrently
- `switchAll()` - Switch to latest inner stream
- `concatAll()` - Flatten stream of streams sequentially
- `exhaustAll()` - Flatten stream of streams, ignore new while active
- `mergeAll()` - Flatten stream of streams concurrently
- `pairwise()` - Emit previous and current values as pairs

### Filtering Operators
- `filter()` - Filter values by predicate
- `distinctUntilChanged()` - Remove consecutive duplicates
- `distinctUntilKeyChanged()` - Remove consecutive duplicates based on key comparison
- `distinct()` - Remove duplicate values (with optional key selector)
- `first()` - Take first value (optionally matching predicate)
- `last()` - Take last value (optionally matching predicate)
- `take()` - Take first N values
- `takeUntil()` - Take until notifier emits
- `takeWhile()` - Take while predicate is true
- `skip()` - Skip first N values
- `skipWhile()` - Skip while predicate is true
- `ignoreElements()` - Ignore all values, preserve completion

### Timing Operators
- `debounceTime()` - Emit latest value after quiet period
- `throttleTime()` - Limit emission rate
- `timeout()` - Error if no value within duration
- `delay()` - Delay emissions by specified time

### Buffering Operators
- `buffer()` - Buffer into arrays of specified size
- `startWith()` - Prepend values to stream

### Utility Operators
- `tap()` - Observe values without modification
- `on()` - Attach lifecycle callbacks
- `catchError()` - Handle errors with fallback stream
- `schedule()` - Control emission timing with scheduler
- `through()` - Use native TransformStream
- `withLatestFrom()` - Combine with latest from other stream
- `defaultIfEmpty()` - Provide default value for empty streams
- `count()` - Count values (optionally with predicate)

### Schedulers
- `IdleScheduler` - Schedule during idle time
- `FrameScheduler` - Schedule with animation frames

### Subjects
- `Subject<T>` - Multicast stream (hot observable)
- `BehaviourSubject<T>` - Subject that remembers last value
- `ReplaySubject<T>` - Subject that replays buffered values to new subscribers

### Utilities
- `toTransform()` - convert an operator factory to a TransformStream

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



## Consuming

### toArray\<T>(src: ReadableStream\<T>): Promise\<T[]>

Consumes a ReadableStream and returns all values as an array. The stream will be read to completion.

```ts
let result = await toArray(from([1, 2, 3, 4]));
// Result: [1, 2, 3, 4]
```

### toPromise\<T>(src: ReadableStream\<T>): Promise\<T>

Consumes a ReadableStream and returns the last value emitted. The stream will be read to completion.

```ts
let result = await toPromise(from([1, 2, 3, 4]));
// Result: 4
```

### toString\<T>(src: ReadableStream\<T>, selector?: (value: T) => string): Promise\<string>

Consumes a ReadableStream and combines all chunks into a single string using an optional selector function.

```ts
let result = await toString(from(['hello', ' ', 'world']));
// Result: "hello world"

let result2 = await toString(from([1, 2, 3]), x => x.toString() + ',');
// Result: "1,2,3,"
```

### subscribe\<T>(src, next, complete?, error?): SubscriptionLike

Immediately begins to read from src, passing each chunk to the `next` callback and awaiting if it returns a promise. 
Once the source signals the end of the stream, `complete` is called. 
If the source stream throws an error, this is passed to the `error` callback.
Returns a subscription object with an `unsubscribe` method to stop reading.

```ts 
let src = from(function*() { yield 1; yield 2; yield 3; });

subscribe(src, 
  (next) => { console.log("Next:", next); },
  () => { console.log("Complete"); },
  (err) => { console.log("Error:", err); }
);
```

## Piping

To aid in pipelining operators, a `pipe` and `retryPipe` method is available: 

### pipe\<T>(src: ReadableStream\<T>, ...ops: Op[], options?: { highWaterMark?: number }): ReadableStream

Pipes a source stream through a series of operators, creating a transformation pipeline. Each operator transforms the stream in some way. The optional `highWaterMark` parameter controls buffering (defaults to 1).

```ts
let result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    filter(x => x != 3),
    map(x => x * 2),
    { highWaterMark: 8 }
  )
);
// Result: [2, 4, 8]
```

⚠️ReadableStreams are not recoverable like Observables are. If you start and consume a stream, that instance cannot be reused.  

### retryPipe\<T>(streamFactory: () => ReadableStream\<T>, ...operators: Op[], options?: RetryPipeOptions): ReadableStream\<T>

Creates a retry pipe that can recreate the entire stream pipeline on error. Unlike regular streams, this allows for retry semantics by recreating the source stream and reapplying all operators.

```ts
const result = retryPipe(
  () => fetchDataStream(), // Function that creates a new stream
  map(x => x * 2),
  filter(x => x > 10),
  { retries: 3, delay: 1000, highWaterMark: 8 }
);
```
⚠️ All operators within this library generally follow the pattern: 

```ts
function opmaker(args){
  // arg parsing
  return function op(in: ReadableStream){ 
    // state...
    return out /* ReadableStream */
  }
}
```
i.e. they do not cache or store values within the opmaker scope. This means that they are compatible with the retryPipe, where it will regenerate and repipe the op function pipeline on each retry. If you use custom operators, ensure they follow the same rule. 


### toTransform(operatorFactory): TransformStream

Sometimes you want to use existing operators as native Web Streams TransformStreams (for example to use with `pipeThrough`). The `toTransform` helper converts any unary operator factory into a constructable `TransformStream` class. This allows you to do:

```ts
import { toTransform } from 'web-streams-extensions';
import { map } from 'web-streams-extensions/operators';

const MapTransform = toTransform(map);

...

source.pipeThrough(new MapTransform((x: number) => x * 2));
```

For convenience, all operators are re-exported as TransformStream constructors from `web-streams-extensions/transformers`. For example:

```ts
import { MapTransform } from 'web-streams-extensions/transformers';

someStream
  .pipeThrough(new MapTransform((x: number) => x * 2))
  .pipeTo(...
```

️⚠️`web-streams-extensions/transformers` may not be tree-shakeable unless your bundler understands `/* @__PURE__ */`

## Creation Functions

### empty(): ReadableStream\<never>

Creates a stream that completes immediately without emitting any values.

```ts
let result = await toArray(empty());
// Result: []
```

### throwError(error: any): ReadableStream\<never>

Creates a stream that immediately emits an error.

```ts
try {
  await toArray(throwError(new Error('Something went wrong')));
} catch (error) {
  console.log(error.message); // "Something went wrong"
}
```

### timer(delay: number, interval?: number): ReadableStream\<number>

Creates a stream that emits after a delay, optionally repeating at intervals.

```ts
// Single emission after 1000ms
let result = await toArray(pipe(timer(1000), take(1)));
// Result: [0]

// Emit every 500ms starting after 1000ms
let result = await toArray(pipe(timer(1000, 500), take(3)));
// Result: [0, 1, 2]
```

### range(start: number, count: number): ReadableStream\<number>

Creates a stream that emits a sequence of numbers in a range.

```ts
let result = await toArray(range(5, 3));
// Result: [5, 6, 7]
```

### combineLatest\<T>(sources: ReadableStream\<T>[], project?: (...values: T[]) => R): ReadableStream\<T[] | R>

Combines the latest values from multiple streams, emitting whenever any source emits.

```ts
let numbers = from([1, 2, 3]);
let letters = from(['a', 'b', 'c']);

let result = await toArray(combineLatest([numbers, letters]));
// Result: [[1, 'a'], [2, 'b'], [3, 'c']]
```

### race\<T>(...sources: ReadableStream\<T>[]): ReadableStream\<T>

Returns a stream that mirrors the first source stream to emit a value.

```ts
let fast = timer(100);
let slow = timer(500);

let result = await toArray(pipe(race(fast, slow), take(1)));
// Result: [0] (from the faster timer)
```

## Operators

### Transformation Operators

#### map\<T, R>(select: (chunk: T) => R | Promise\<R>): Op\<T, R>

Maps each value in a stream through a selector function. Values where the selector returns undefined are filtered out.

```ts
let result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    map(x => x * 2)
  )
);
// Result: [2, 4, 6, 8]
```

#### mapSync\<T, R>(select: (chunk: T) => R): Op\<T, R>

Synchronous version of `map` for better performance when no async operations are needed. Also allows explicitly mapping to `Promise` objects, where the normal `map` would `await` the select result. 

```ts
let result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    mapSync(x => x * 2)
  )
);
// Result: [2, 4, 6, 8]
```

#### scan\<T, R>(accumulator: (acc: R, value: T, index: number) => R | Promise\<R>, seed: R): Op\<T, R>

Applies an accumulator function to each value and emits each intermediate result. Like Array.reduce but emits all intermediate values.

```ts
let result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    scan((acc, val) => acc + val, 0)
  )
);
// Result: [0, 1, 3, 6, 10]
```

#### reduce\<T, R>(accumulator: (acc: R, value: T, index: number) => R | Promise\<R>, seed: R): Op\<T, R>

Applies an accumulator function to each value and emits only the final result. Like Array.reduce but for streams - only emits when the source stream completes.

```ts
let result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    reduce((acc, val) => acc + val, 0)
  )
);
// Result: [10]
```

#### switchMap\<T, R>(project: (value: T, index: number, signal?: AbortSignal) => ReadableStream<R>): Op\<T, R>

Maps each source value to a stream and flattens them, but only the most recent inner stream emits values. When a new source value arrives, the previous inner stream is cancelled and a new one is created from the projection function. The optional `AbortSignal` parameter allows the projection function to properly cancel ongoing operations like HTTP requests.

**Deterministic behavior:**
- **Synchronous source and inner streams**: Only partial values from earlier projections may emit before being cancelled
- **Async projections**: Timing determines which values are emitted before cancellation
- **Last projection**: Always completes fully since there's no subsequent value to cancel it

```ts
// Synchronous source with synchronous projections
let result = await toArray(
  pipe(
    from([1, 2, 3]),
    switchMap(n => from([n, n * 2, n * 3]))
  )
);
// Result: [1, 2, 3, 6, 9] - partial results from each projection
// Breakdown:
//   n=1: emits [1] then cancelled by n=2
//   n=2: emits [2] then cancelled by n=3  
//   n=3: emits [3, 6, 9] completely (no cancellation)

// Simulating user typing with debounced search requests
let searchTerms = from(['a', 'ab', 'abc']);
let result = await toArray(
  pipe(
    searchTerms,
    switchMap(term => 
      // Each search term creates a new "API request" stream
      from([`${term}-result1`, `${term}-result2`, `${term}-result3`])
    )
  )
);
// Result: ['a-result1', 'ab-result1', 'abc-result1', 'abc-result2', 'abc-result3']
// Earlier searches for 'a' and 'ab' are cancelled when newer terms arrive

// Practical HTTP example with real cancellation
const searchResults = pipe(
  userInputDebounced,                         // Stream of search terms
  switchMap((term, index, signal) =>         // AbortSignal for proper cancellation
    fetch(`/api/search?q=${term}`, { signal }) // Pass signal to fetch for cancellation
      .then(response => response.json())      // Parse JSON response
      .then(data => from(data.results))       // Convert to stream of results
  )
);
// Previous HTTP requests are automatically cancelled when user types new search terms

// Custom cancellable operations using AbortSignal
const cancellableOperations = pipe(
  userActions,
  switchMap((action, index, signal) => {
    return new ReadableStream({
      start(controller) {
        // Set up a long-running operation
        const timeoutId = setTimeout(() => {
          if (!signal?.aborted) {
            controller.enqueue(`result-${action}`);
            controller.close();
          }
        }, 1000);
        
        // Handle cancellation
        signal?.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          controller.close();
        });
      }
    });
  })
);
// Previous operations are automatically cancelled when new actions arrive
```

#### concatMap\<T, R>(project: (value: T, index: number) => ReadableStream\<R> | Promise\<R> | Iterable\<R> | AsyncIterable\<R>): Op\<T, R>

Maps each source value to a stream, promise, iterable, or async iterable and concatenates them sequentially. Each inner stream completes before the next one starts.

```ts
let result = await toArray(
  pipe(
    from([1, 2, 3]),
    concatMap(n => from([n, n * 10]))
  )
);
// Result: [1, 10, 2, 20, 3, 30]

// Works with promises
let result2 = await toArray(
  pipe(
    from([1, 2]),
    concatMap(n => Promise.resolve(n * 2))
  )
);
// Result: [2, 4]

// Works with iterables
let result3 = await toArray(
  pipe(
    from([1, 2, 3]),
    concatMap(n => [n, n * 10]) // Array is an iterable
  )
);
// Result: [1, 10, 2, 20, 3, 30]

// Works with custom iterables
let result4 = await toArray(
  pipe(
    from([1, 2]),
    concatMap(n => ({
      *[Symbol.iterator]() {
        yield n;
        yield n * 2;
        yield n * 3;
      }
    }))
  )
);
// Result: [1, 2, 3, 2, 4, 6]
```

#### exhaustMap\<T, R>(project: (value: T, index: number) => ReadableStream\<R> | Promise\<R> | Iterable\<R> | AsyncIterable\<R>): Op\<T, R>

Maps each source value to a stream, but ignores new source values while the current inner stream is still active.

```ts
// Only the first value gets processed while others are ignored
let result = await toArray(
  pipe(
    from([1, 2, 3]),
    exhaustMap(n => from([n, n * 10]))
  )
);
// Result: [1, 10] (2 and 3 are ignored while first stream is active)
```

#### concatAll\<T>(): Op\<ReadableStream\<T> | Promise\<T> | Iterable\<T> | AsyncIterable\<T>, T>

Flattens a stream of streams, promises, iterables, or async iterables by concatenating them sequentially. Each inner source completes before the next one starts.

```ts
// With ReadableStreams
let result = await toArray(
  pipe(
    from([
      from([1, 2]),
      from([3, 4]),
      from([5, 6])
    ]),
    concatAll()
  )
);
// Result: [1, 2, 3, 4, 5, 6]

// With arrays (iterables)
let result2 = await toArray(
  pipe(
    from([
      [1, 2],
      [3, 4], 
      [5, 6]
    ]),
    concatAll()
  )
);
// Result: [1, 2, 3, 4, 5, 6]

// With promises
let result3 = await toArray(
  pipe(
    from([
      Promise.resolve([1, 2]),
      Promise.resolve([3, 4])
    ]),
    concatAll()
  )
);
// Result: [1, 2, 3, 4]
```

#### mergeAll\<T>(concurrent?: number): Op\<ReadableStream\<T> | Promise\<T> | Iterable\<T> | AsyncIterable\<T>, T>

Flattens a stream of streams, promises, iterables, or async iterables by merging them concurrently with optional concurrency control.

```ts
// With ReadableStreams
let result = await toArray(
  pipe(
    from([
      from([1, 2]),
      from([3, 4])
    ]),
    mergeAll()
  )
);
// Result: [1, 2, 3, 4] (order may vary due to concurrency)

// With arrays (iterables)
let result2 = await toArray(
  pipe(
    from([
      [1, 2],
      [3, 4]
    ]),
    mergeAll()
  )
);
// Result: [1, 2, 3, 4] (order may vary due to concurrency)

// With mixed types and concurrency limit
let result3 = await toArray(
  pipe(
    from([
      Promise.resolve([1, 2]),
      [3, 4],
      from([5, 6])
    ]),
    mergeAll(2) // Max 2 concurrent inner sources
  )
);
// Result: [1, 2, 3, 4, 5, 6] (order may vary due to concurrency)
```

#### switchAll\<T>(): Op\<ReadableStream\<T>, T>

Flattens a stream of streams by switching to each new inner stream, cancelling the previous one. When a new inner stream arrives, the previous inner stream is immediately cancelled and the new one takes over.

**Deterministic behavior:**
- **Synchronous streams**: When the source stream emits synchronous inner streams rapidly, only the final stream emits its complete values
- **Asynchronous streams**: Earlier streams are cancelled when newer ones arrive, but some values may be emitted before cancellation
- **Empty streams**: If the source stream is empty, the output stream completes immediately

```ts
// Synchronous streams - only last stream emits
let result = await toArray(
  pipe(
    from([
      from([1, 2]),      // Cancelled immediately
      from([3, 4]),      // Cancelled immediately  
      from([5, 6])       // Completes normally
    ]),
    switchAll()
  )
);
// Result: [5, 6] - previous streams cancelled before emitting

// Asynchronous streams with timing
let result = await toArray(
  pipe(
    from([
      timer(100).pipe(map(() => 'first')),   // May emit before cancellation
      timer(50).pipe(map(() => 'second')),   // May emit before cancellation
      timer(25).pipe(map(() => 'third'))     // Completes first
    ]),
    switchAll()
  )
);
// Result: ['third'] - fastest stream wins

// Practical example: search cancellation
const searchStream = pipe(
  userSearchInputs,                    // Stream of search terms
  map(term => fetchSearchResults(term)), // Each term -> HTTP request stream
  switchAll()                          // Cancel previous search when new term arrives
);
// Only the most recent search completes, previous searches are cancelled
```

#### exhaustAll\<T>(): Op<ReadableStream\<T> | Promise\<T> | Iterable\<T> | AsyncIterable\<T>, T>

Flattens a stream of streams, promises, iterables, or async iterables by ignoring new inner sources while the current one is still active. When a new inner source arrives while one is already being processed, it is discarded. This is the opposite of `switchAll` - instead of cancelling the current stream, it ignores new ones.

**Deterministic behavior:**
- **First inner source**: Always processed completely
- **Subsequent sources**: Ignored if an inner source is currently active
- **After completion**: Once an inner source completes, the next available source (if any) is processed

```ts
// Synchronous sources - first source wins, others ignored
let result = await toArray(
  pipe(
    from([
      [1, 2, 3],      // Processed completely
      [4, 5, 6],      // Ignored (first still active)
      [7, 8, 9]       // Ignored (first still active)
    ]),
    exhaustAll()
  )
);
// Result: [1, 2, 3] - only first array is processed

// Asynchronous sources with timing
let result2 = await toArray(
  pipe(
    from([
      timer(50).pipe(map(() => 'first')),    // Fast, gets processed
      timer(100).pipe(map(() => 'second')),  // Ignored (first still active)
      timer(200).pipe(map(() => 'third'))    // Processed after first completes
    ]),
    exhaustAll()
  )
);
// Result: ['first', 'third'] - second is ignored

// Practical example: Preventing duplicate form submissions
const formSubmissions = pipe(
  userClickEvents,                    // Stream of button clicks
  map(click => submitFormToAPI(click)), // Each click -> HTTP request
  exhaustAll()                        // Ignore clicks while request is pending
);
// Prevents multiple simultaneous form submissions
```

#### pairwise\<T>(): Op\<T, [T, T]>

Emits the previous and current values as a pair. Only starts emitting after the second value.

```ts
let result = await toArray(
  pipe(
    from([1, 2, 3, 4, 5]),
    pairwise()
  )
);
// Result: [[1, 2], [2, 3], [3, 4], [4, 5]]
```

#### delay\<T>(duration: number): Op\<T, T>

Delays the emission of each value by the specified duration in milliseconds.

```ts
const start = Date.now();
let result = await toArray(
  pipe(
    from([1, 2, 3]),
    delay(100)
  )
);
const elapsed = Date.now() - start;
// Result: [1, 2, 3] (after ~100ms delay)
// elapsed >= 100
```

### Filtering Operators

#### filter\<T>(predicate: (chunk: T) => boolean): Op\<T, T>

Filters out chunks that fail a predicate test. Only values that pass the predicate are emitted.

```ts
let result = await toArray(
  pipe(
    from([1, 2, 3, 4, 5]),
    filter(x => x % 2 === 0)
  )
);
// Result: [2, 4]
```

#### distinctUntilChanged\<T>(compare?: (previous: T, current: T) => boolean): Op\<T, T>

Only emits when the current value is different from the previous value. Uses strict equality (===) by default, or a custom comparison function.

```ts
let result = await toArray(
  pipe(
    from([1, 1, 2, 2, 2, 3, 1]),
    distinctUntilChanged()
  )
);
// Result: [1, 2, 3, 1]
```

#### distinctUntilKeyChanged\<T, K extends keyof T>(key: K, compare?: (x: T[K], y: T[K]) => boolean): Op\<T, T>

Only emits when the current value is different from the previous value, based on a specific key. Uses strict equality (===) by default on the selected key, or a custom comparison function.

```ts
// Basic usage with key comparison
let result = await toArray(
  pipe(
    from([
      { id: 1, name: 'Alice' },
      { id: 1, name: 'Alice Updated' },
      { id: 2, name: 'Bob' },
      { id: 1, name: 'Alice Again' }
    ]),
    distinctUntilKeyChanged('id')
  )
);
// Result: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }, { id: 1, name: 'Alice Again' }]

// Custom comparison function
let result2 = await toArray(
  pipe(
    from([
      { name: 'Foo1' },
      { name: 'Foo2' },
      { name: 'Bar' },
      { name: 'Foo3' }
    ]),
    distinctUntilKeyChanged('name', (x, y) => x.substring(0, 3) === y.substring(0, 3))
  )
);
// Result: [{ name: 'Foo1' }, { name: 'Bar' }, { name: 'Foo3' }]
```

#### first\<T>(predicate?: (chunk: T) => boolean): Op\<T, T>

Emits only the first value that matches the predicate, then completes. If no predicate is provided, emits the first value.

```ts
let result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    first(x => x > 2)
  )
);
// Result: [3]
```

#### last\<T>(predicate?: (chunk: T) => boolean): Op\<T, T>

Emits only the last value that matches the predicate. If no predicate is provided, emits the last value. The stream must complete for the last value to be emitted.

```ts
let result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    last(x => x < 4)
  )
);
// Result: [3]
```

#### take\<T>(count: number): Op\<T, T>

Takes only the first `count` elements, then completes the stream.

```ts
let result = await toArray(
  pipe(
    from([1, 2, 3, 4, 5]),
    take(3)
  )
);
// Result: [1, 2, 3]
```

#### takeUntil\<T>(notifier: ReadableStream\<any>): Op\<T, T>

Takes values from the source until the notifier stream emits a value. When the notifier emits, the source stream is cancelled and the output completes.

```ts
let result = await toArray(
  pipe(
    interval(100), // Emits every 100ms
    takeUntil(interval(1000)) // Stop after 1 second
  )
);
// Will emit about 10 values before stopping
```

#### skip\<T>(count: number): Op\<T, T>

Skips the first `count` elements and then streams the rest to the output.

```ts
let result = await toArray(
  pipe(
    from([1, 2, 3, 4, 5]),
    skip(2)
  )
);
// Result: [3, 4, 5]
```

#### distinct\<T>(keySelector?: (value: T) => any): Op\<T, T>

Filters out duplicate values. Uses strict equality by default, or a key selector function for custom comparison.

```ts
let result = await toArray(
  pipe(
    from([1, 2, 2, 3, 1, 4, 3]),
    distinct()
  )
);
// Result: [1, 2, 3, 4]

// With key selector
let result2 = await toArray(
  pipe(
    from([
      { id: 1, name: 'John' },
      { id: 2, name: 'Jane' },
      { id: 1, name: 'John Doe' }
    ]),
    distinct(person => person.id)
  )
);
// Result: [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }]
```

#### skipWhile\<T>(predicate: (value: T) => boolean): Op\<T, T>

Skips values while the predicate returns true, then emits all remaining values.

```ts
let result = await toArray(
  pipe(
    from([1, 2, 3, 2, 4, 1, 5]),
    skipWhile(x => x < 3)
  )
);
// Result: [3, 2, 4, 1, 5]
```

#### takeWhile\<T>(predicate: (value: T) => boolean): Op\<T, T>

Takes values while the predicate returns true, then completes.

```ts
let result = await toArray(
  pipe(
    from([1, 2, 3, 4, 5]),
    takeWhile(x => x < 3)
  )
);
// Result: [1, 2]
```

#### ignoreElements\<T>(): Op\<T, never>

Ignores all emitted values and only preserves the completion or error signal.

```ts
let result = await toArray(
  pipe(
    from([1, 2, 3, 4, 5]),
    ignoreElements()
  )
);
// Result: []
```

### Timing Operators

#### debounceTime\<T>(duration: number): Op\<T, T>

Emits a notification from the source stream only after a particular time span has passed without another source emission. Like delay, but passes only the most recent value from each burst of emissions.

**RxJS-compatible behavior:**
- Delays values emitted by the source stream
- Drops previous pending delayed emissions if a new value arrives
- Keeps track of the most recent value and emits it only when duration has passed without any other value
- If stream completes during the debounce period, the most recent value is emitted before completion

```ts
// Simulate rapid user input with pauses
const userInputs = from(['h', 'e', 'l', 'l', 'o']); // Rapid typing
const debounced = pipe(
  userInputs,
  debounceTime(300) // Wait 300ms after last input
);
// Result: ['o'] - only the latest value after silence

// Real-world search example
const searchInput = pipe(
  keystrokes,
  debounceTime(500), // Wait 500ms after user stops typing
  map(chars => chars.join('')), // Join characters into search term
  switchMap((term, index, signal) => fetch(`/api/search?q=${term}`, { signal })) // Search when typing stops
);
```

#### throttleTime\<T>(duration: number): Op\<T, T>

Limits the rate of emissions to at most one per specified time period. The first value is emitted immediately, then subsequent values are ignored until the time period expires.

**Deterministic behavior:**
- **First value**: Always emitted immediately
- **Subsequent values**: Ignored until `duration` milliseconds have passed since the last emission
- **Throttle state**: Maintains a "leading edge" behavior - emits at the start of each time window

```ts
// Throttle rapid button clicks
const buttonClicks = interval(100); // Click every 100ms
let result = await toArray(
  pipe(
    buttonClicks,
    throttleTime(300), // Only allow one click per 300ms
    take(5)
  )
);
// Timeline: emit at 0ms, ignore at 100ms & 200ms, emit at 300ms, etc.
// Result: [0, 3, 6, 9, 12] - values emitted at 300ms intervals

// Practical example: API rate limiting
const apiRequests = pipe(
  userActions,
  throttleTime(1000), // Max 1 request per second
  switchMap((action, index, signal) => callAPI(action, signal))
);
```

#### timeout\<T>(duration: number): Op\<T, T>

Emits an error if the duration waiting for a chunk exceeds the specified timeout in milliseconds.

```ts
let stream = pipe(
  from(slowAsyncGenerator()),
  timeout(5000) // Error if no value within 5 seconds
);
```

### Buffering Operators

#### buffer\<T>(count: number): Op\<T, T[]>

Buffers elements and emits them as arrays when the buffer reaches the specified count. The final buffer (if not empty) is emitted when the source stream completes.

```ts
let result = await toArray(
  pipe(
    from([1, 2, 3, 4, 5]),
    buffer(2)
  )
);
// Result: [[1, 2], [3, 4], [5]]
```

#### startWith\<T>(...values: T[]): Op\<T, T>

Prepends the specified values to the beginning of the source stream.

```ts
let result = await toArray(
  pipe(
    from([3, 4, 5]),
    startWith(1, 2)
  )
);
// Result: [1, 2, 3, 4, 5]
```

### Combination Operators

#### concat\<T>(): Op\<ReadableStream\<T>, T>

Given a ReadableStream of ReadableStreams, concatenates the output of each stream in sequence.

```ts
let streams = [from([1, 2]), from([3, 4]), from([5])];
let result = await toArray(
  pipe(
    from(streams),
    concat()
  )
);
// Result: [1, 2, 3, 4, 5]
```

#### mergeMap\<T, R>(project: (value: T, index: number) => ReadableStream\<R> | Promise\<R> | Iterable\<R> | AsyncIterable\<R>, concurrent?: number): Op\<T, R>

Maps each source value to a ReadableStream, Promise, iterable, or async iterable, then flattens all inner streams into a single output stream with optional concurrency control.

```ts
// Map each number to a stream of that many values
let result = await toArray(
  pipe(
    from([1, 2, 3]),
    mergeMap(n => from(Array(n).fill(n)))
  )
);
// Result: [1, 2, 2, 3, 3, 3] (order may vary due to concurrency)

// Works with iterables (arrays are iterables)
let result2 = await toArray(
  pipe(
    from([1, 2, 3]),
    mergeMap(n => Array(n).fill(n)) // Array as iterable
  )
);
// Result: [1, 2, 2, 3, 3, 3] (order may vary due to concurrency)

// With limited concurrency for HTTP requests
let result3 = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    mergeMap(id => fetch(`/api/data/${id}`).then(r => r.json()), 2)
  )
);
// Only 2 concurrent requests at a time
```

#### exhaustAll\<T>(): Op\<ReadableStream\<T> | Promise\<T> | Iterable\<T> | AsyncIterable\<T>, T>

Flattens a stream of streams, promises, iterables, or async iterables by ignoring new inner sources while the current one is still active. This provides an "exhaust" strategy where new sources are dropped if one is already being processed.

```ts
// With ReadableStreams - first stream wins
let result = await toArray(
  pipe(
    from([
      from([1, 2, 3]),
      from([4, 5, 6]),
      from([7, 8, 9])
    ]),
    exhaustAll()
  )
);
// Result: [1, 2, 3] - subsequent streams are ignored

// With mixed types
let result2 = await toArray(
  pipe(
    from([
      [1, 2],                    // Processed
      Promise.resolve([3, 4]),   // Ignored (first still active)
      [5, 6]                     // Processed after first completes
    ]),
    exhaustAll()
  )
);
// Result: [1, 2, 5, 6] - promise is ignored
```

#### withLatestFrom\<T, U, R>(other: ReadableStream\<U>, combiner?: (value: T, otherValue: U) => R): Op\<T, R | [T, U]>

Combines each emission from the source stream with the latest value from another stream. Only emits when the source emits, using the most recent value from the other stream.

```ts
let numbers = from([1, 2, 3]);
let letters = from(['a', 'b', 'c']);

let result = await toArray(
  pipe(
    numbers,
    withLatestFrom(letters) // Combine with latest from letters
  )
);
// Result: [[1, 'a'], [2, 'b'], [3, 'c']]
```

#### pairwise\<T>(): Op\<T, [T, T]>

Emits the previous and current value as a pair. Skips the first emission since there's no previous value.

```ts
let result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    pairwise()
  )
);
// Result: [[1, 2], [2, 3], [3, 4]]
```

### Utility Operators

#### tap\<T>(cb: (chunk: T) => void | Promise): Op\<T, T>

Allows observing each chunk without modifying the stream. The output is exactly the same as the input.

```ts
let sideEffects = [];
let result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    tap(x => sideEffects.push(x * 2))
  )
);
// Result: [1, 2, 3, 4], sideEffects: [2, 4, 6, 8]
```

#### on\<T>(callbacks: { start?(): void; complete?(): void; cancel?(reason?: any): void; error?(err: any): void }): Op\<T, T>

Creates an operator that allows attaching lifecycle callbacks to a stream. Useful for side effects like logging, cleanup, or state management without modifying the stream's data flow.

```ts
let result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    on({
      start: () => console.log('Stream started'),
      complete: () => console.log('Stream completed'),
      cancel: (reason) => console.log('Stream cancelled:', reason),
      error: (err) => console.error('Stream error:', err)
    })
  )
);
```

#### onComplete\<T>(callback: () => void): Op\<T, T>
#### onComplete\<T>(callback: (reasonOrError?: any) => void, joinErrorCancel: boolean): Op\<T, T>

Convenience operator for handling stream completion. Provides two modes:

**Simple mode** (default): Only handles normal completion
```ts
let result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    onComplete(() => console.log('Stream completed'))
  )
);
```

**Bundled mode**: Handles completion, errors, and cancellation in one callback
```ts
let result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    onComplete((reasonOrError?: any) => {
      if (reasonOrError) {
        console.log('Stream error/cancel:', reasonOrError);
      } else {
        console.log('Stream completed normally');
      }
    }, true)
  )
);
```

#### catchError\<T>(selector: (error: any, caught: ReadableStream\<T>) => ReadableStream\<T>): Op\<T, T>

Catches errors from the source stream and switches to a fallback stream.

```ts
let result = await toArray(
  pipe(
    errorProneStream,
    catchError(err => from(['fallback', 'values']))
  )
);
// If errorProneStream errors, switches to emit 'fallback', 'values'
```

#### schedule\<T>(scheduler: IScheduler): Op\<T, T>

Schedules the emission of values using a custom scheduler.

```ts
import { IdleScheduler } from 'web-streams-extensions/schedulers';

let result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    schedule(new IdleScheduler()) // Emit values during browser idle time
  )
);
```

#### through\<T, R>(transform: TransformStream\<T, R>): Op\<T, R>

Pipes the stream through a TransformStream, allowing integration with native Web Streams API transforms.

```ts
let result = await toArray(
  pipe(
    from(['hello', 'world']),
    through(new TextEncoderStream()) // Use native transform
  )
);
```

#### defaultIfEmpty\<T>(defaultValue: T): Op\<T, T>

Emits a default value if the source stream completes without emitting any values.

```ts
let result = await toArray(
  pipe(
    from([]), // Empty stream
    defaultIfEmpty('default')
  )
);
// Result: ['default']
```

#### count\<T>(predicate?: (value: T) => boolean): Op\<T, number>

Counts the number of emissions from the source stream. If a predicate is provided, only counts emissions that satisfy the predicate.

```ts
let result = await toArray(
  pipe(
    from([1, 2, 3, 4, 5]),
    count(x => x % 2 === 0) // Count even numbers
  )
);
// Result: [2]
```

## Schedulers

Schedulers control when and how stream operations are executed, allowing for better performance and resource management.

### IdleScheduler

A scheduler that uses `requestIdleCallback` when available (in browser environments), falling back to `setTimeout` for compatibility with Node.js and older browsers. Yields control during idle periods, allowing other tasks to run.

```ts
import { IdleScheduler, schedule } from 'web-streams-extensions';

const idleScheduler = new IdleScheduler();

let result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    schedule(idleScheduler) // Process values during idle time
  )
);
```

### FrameScheduler

A scheduler that uses `requestAnimationFrame` when available (in browser environments), falling back to `setTimeout` for compatibility with Node.js and older browsers. Synchronizes operations with the browser's rendering cycle, typically running at 60fps (16.67ms intervals). Ideal for animations, visual updates, and operations that should be synchronized with screen refreshes.

```ts
import { FrameScheduler, schedule } from 'web-streams-extensions';

const frameScheduler = new FrameScheduler();

// Perfect for animation data processing
let result = await toArray(
  pipe(
    from(animationKeyframes),
    schedule(frameScheduler) // Process keyframes at 60fps
  )
);

// Real-world animation example
const animationStream = pipe(
  interval(0),           // Fast source
  map(frame => ({
    frame,
    timestamp: performance.now(),
    position: calculatePosition(frame)
  })),
  schedule(frameScheduler), // Throttle to animation frames
  tap(({ position }) => updateUIElement(position)),
  takeUntil(animationComplete)
);
```

### Custom Schedulers

You can create custom schedulers by implementing the `IScheduler` interface:

```ts
import { IScheduler, schedule } from 'web-streams-extensions';

class CustomScheduler implements IScheduler {
  schedule(callback: () => void): void {
    // Custom scheduling logic - direct control over execution timing
    setTimeout(callback, 10);
  }
}

const customScheduler = new CustomScheduler();

// Use in stream pipeline
let result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    schedule(customScheduler) // Custom 10ms delay between values
  )
);
```

## Subjects

Subjects are duplex streams that act as both readable and writable streams with automatic tee'ing of the readable side. Each access to `subject.readable` returns a _new_ ReadableStream<T> that will receive all subsequent values.

### Subject<T>

A Subject is a special type of stream that allows values to be multicast to many observers. It implements both readable and writable streams with full Web Streams compatibility.

**Key features:**
- Each call to `.readable` returns a new ReadableStream
- Values can be pushed via `.writable` or directly via `.next()`
- Automatic resource cleanup and error handling
- Full Web Streams compatibility

**Properties:**
```ts
readonly readable: ReadableStream<T>;  // Creates a new readable stream
readonly writable: WritableStream<T>;  // Writable side for piping
readonly closed: boolean;              // Whether the subject is closed
```

**Methods:**
```ts
next(value: T): Promise<number>;       // Push a value directly
complete(): Promise<void>;             // Complete the subject
error(err: any): Promise<void>;        // Error the subject
subscribe(subscriber): SubscriptionLike; // Subscribe with callbacks
```

**Example usage:**

```ts
import { Subject, pipe, map, filter, toArray } from 'web-streams-extensions';

// Create a subject
const subject = new Subject<number>();

// Get multiple readers
const reader1 = toArray(pipe(subject.readable, filter(x => x % 2 === 0)));
const reader2 = toArray(pipe(subject.readable, map(x => x * 2)));

// Push values
await subject.next(1);
await subject.next(2);
await subject.next(3);
await subject.next(4);
await subject.complete();

const evenNumbers = await reader1; // [2, 4]
const doubled = await reader2;     // [2, 4, 6, 8]
```

**pipeTo to a subject:**

```ts
const source = from([1, 2, 3, 4]);
const subject = new Subject<number>();

// Pipe source to subject
source.pipeTo(subject.writable);

// Read from subject
const result = await toArray(subject.readable);
console.log(result); // [1, 2, 3, 4]
```

**pipeThrough` the subject:**

```ts
let input = [1, 2, 3, 4];
let subject = new Subject<number>();

let result = await toArray(from(input).pipeThrough(subject));

expect(result).to.be.deep.eq(expected); // [1,2,3,4]
```

### BehaviourSubject\<T>

A BehaviourSubject is like a Subject but remembers the last emitted value and immediately emits it to new subscribers.

```ts
const behaviorSubject = new BehaviourSubject(42);

// New subscribers immediately get the last value
const result = await toArray(pipe(behaviorSubject.readable, take(1)));
console.log(result); // [42]
```

### ReplaySubject\<T>

A ReplaySubject is a variant of Subject that "replays" old values to new subscribers by emitting them when they first subscribe. It maintains an internal buffer of previously emitted values that can be configured by buffer size and/or time window.

**Key features:**
- Buffers emitted values for replay to new subscribers
- Configurable buffer size (default: Infinity)
- Configurable time window for buffered values (default: Infinity)
- Custom timestamp provider support
- Replays values even after error (unlike BehaviorSubject)

**Constructor:**
```ts
new ReplaySubject<T>(bufferSize?: number, windowTime?: number, timestampProvider?: () => number)
```

**Parameters:**
- `bufferSize` - Maximum number of values to buffer (default: Infinity)
- `windowTime` - Time in milliseconds to keep values in buffer (default: Infinity)
- `timestampProvider` - Function that returns current timestamp (default: Date.now)

**Properties:**
```ts
readonly bufferSize: number;        // Current number of buffered values
readonly maxBufferSize: number;     // Maximum buffer size
readonly windowTime: number;        // Window time in milliseconds
```

**Basic usage:**

```ts
import { ReplaySubject, toArray, pipe, map } from 'web-streams-extensions';

// Create a replay subject with default settings (infinite buffer)
const subject = new ReplaySubject<number>();

// Emit some values
await subject.next(1);
await subject.next(2);
await subject.next(3);

// New subscribers get all previously emitted values
const result = await toArray(pipe(subject.readable, take(3)));
console.log(result); // [1, 2, 3]
```

**With buffer size limit:**

```ts
// Only keep last 2 values
const subject = new ReplaySubject<number>(2);

await subject.next(1);
await subject.next(2);
await subject.next(3);
await subject.next(4);

// New subscriber only gets last 2 values
const result = await toArray(pipe(subject.readable, take(2)));
console.log(result); // [3, 4]
```

**With time window:**

```ts
// Keep values for 5 seconds
const subject = new ReplaySubject<number>(Infinity, 5000);

await subject.next(1);
await sleep(3000);
await subject.next(2);
await sleep(3000); // First value is now 6 seconds old

// New subscriber only gets values within time window
const result = await toArray(pipe(subject.readable, take(1)));
console.log(result); // [2] - value 1 expired
```

**Combined buffer size and time window:**

```ts
// Keep max 3 values, but only for 2 seconds
const subject = new ReplaySubject<number>(3, 2000);

// Most restrictive constraint applies (whichever removes values first)
```

**Differences from BehaviorSubject:**
1. **No initial value required:** ReplaySubject doesn't need a constructor argument
2. **Multiple values:** Can replay multiple values, not just the last one
3. **Replay after error:** Unlike BehaviorSubject, ReplaySubject continues to replay buffered values to new subscribers even after an error occurs
4. **Configurable buffering:** Buffer size and time window can be customized

**Integration with existing Subject functionality:**

```ts
// Works with all existing Subject features
const subject = new ReplaySubject<number>();

// Can be used with pipeTo/pipeThrough
from([1, 2, 3]).pipeTo(subject.writable);
const result = await toArray(from([4, 5]).pipeThrough(subject));
// Result includes replayed values: [1, 2, 3, 4, 5]

// Works with operators
const doubled = await toArray(
  pipe(subject.readable, map(x => x * 2), take(3))
);
```

## Error Handling

All operators and functions include proper error handling with automatic resource cleanup. When an error occurs anywhere in a stream pipeline, all resources (readers, timers, etc.) are automatically cleaned up.

### Basic Error Handling

```ts
try {
  const result = await toArray(
    pipe(
      from([1, 2, 3, 4]),
      map(x => {
        if (x === 3) throw new Error('Value 3 not allowed');
        return x * 2;
      }),
      timeout(5000)
    )
  );
} catch (error) {
  console.error('Stream error:', error.message); // "Value 3 not allowed"
  // All resources are automatically cleaned up
}
```

### Error Recovery with catchError

```ts
const resilientStream = pipe(
  from([1, 2, 3, 4]),
  map(x => {
    if (x === 3) throw new Error('Temporary failure');
    return x * 2;
  }),
  catchError(error => {
    console.log('Caught error:', error.message);
    return from(['fallback-value']); // Continue with fallback stream
  })
);

const result = await toArray(resilientStream);
// Result: [2, 4, 'fallback-value', 8]
// Processing continues after error with fallback values
```

### Error Handling in Async Operations

```ts
const apiStream = pipe(
  from(['url1', 'url2', 'invalid-url', 'url3']),
  map(async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }),
  catchError(error => {
    console.log('API call failed:', error.message);
    return from([{ error: 'Failed to fetch data' }]);
  })
);

// Stream continues processing valid URLs even if some fail
```

### Resource Cleanup Guarantees

The library ensures that all resources are properly cleaned up even when errors occur:

- **Readers**: Automatically released and cancelled
- **Timers**: Cleared and cancelled (`setTimeout`, `setInterval`)
- **HTTP requests**: Aborted when streams are cancelled
- **Memory**: Buffers and queues are cleared

```ts
const streamWithResources = pipe(
  interval(100),                    // Creates internal timer
  mergeMap(i => fetch(`/api/${i}`)), // Creates HTTP requests
  buffer(5),                        // Creates internal buffer
  timeout(1000)                     // Creates timeout timer
);

try {
  await toArray(pipe(streamWithResources, take(2)));
} catch (error) {
  // If timeout or other error occurs:
  // - interval timer is cleared
  // - HTTP requests are aborted  
  // - buffer is cleared
  // - timeout timer is cleared
  console.log('All resources cleaned up automatically');
}
```

## Backpressure

The library implements proper backpressure handling throughout the pipeline, automatically slowing down fast producers when consumers can't keep up. This prevents memory buildup and ensures stable performance.

### How Backpressure Works

Backpressure is achieved by:
1. **`controller.desiredSize`**: Operators check this to know when to pause production
2. **Pull-based reading**: Most operators wait for 'pull' calls before producing more values
3. **Buffer limits**: Configurable `highWaterMark` controls internal buffering

⚠️ ReadableStreams are non-blocking: if a producer does NOT adhere to `controller.desiredSize` and keeps enqueue'ing values it can cause unbounded growth of internal buffers. 


### Automatic Backpressure Example

```ts
// Fast producer with slow consumer - backpressure automatically applies
const fastProducer = interval(10);  // Emits every 10ms
const slowConsumer = pipe(
  fastProducer,
  map(async x => {
    await sleep(100);  // Slow async operation (100ms per item)
    return x * 2;
  }),
  take(5)
);

// The interval will automatically slow down to match the map operator's pace
// No memory buildup occurs - the producer waits for the consumer
const result = await toArray(slowConsumer);
// Takes ~500ms total (5 items × 100ms each) instead of ~50ms without backpressure
```

### Configuring Backpressure

You can control backpressure behavior using the `highWaterMark` option:

```ts
// Small buffer - more aggressive backpressure
const tightBackpressure = pipe(
  from(largeDataSet),
  map(x => expensiveOperation(x)),
  { highWaterMark: 1 }  // Process one item at a time
);

// Larger buffer - more throughput, more memory usage
const looserBackpressure = pipe(
  from(largeDataSet), 
  map(x => expensiveOperation(x)),
  { highWaterMark: 16 } // Process up to 16 items ahead
);
```

### Real-World Backpressure Scenarios

```ts
// File processing with backpressure
const fileProcessor = pipe(
  from(largeFileList),
  map(async filename => {
    const content = await fs.readFile(filename);  // Disk I/O
    return processContent(content);               // CPU-intensive
  }),
  filter(result => result.isValid),
  { highWaterMark: 3 }  // Process max 3 files concurrently
);

// HTTP API with rate limiting
const apiProcessor = pipe(
  from(apiEndpoints),
  map(async endpoint => {
    await sleep(1000);  // Rate limit: 1 request per second
    return fetch(endpoint).then(r => r.json());
  }),
  { highWaterMark: 2 }  // Max 2 pending requests
);

// Database batch processing
const dbProcessor = pipe(
  from(records),
  buffer(100),          // Process in batches of 100
  map(async batch => {
    return db.insertMany(batch);  // Batch database operation
  }),
  { highWaterMark: 1 }  // One batch at a time to avoid overwhelming DB
);
```

### Benefits of Proper Backpressure

- **Memory stability**: Prevents unbounded memory growth
- **Resource efficiency**: Balances throughput with resource usage  
- **Error resilience**: Reduces likelihood of out-of-memory errors
- **Predictable performance**: Maintains consistent processing rates 

## Browser Compatibility

This library requires support for:
- ReadableStream (for all functionality)
- WritableStream (for Subjects)
- async/await (ES2017)

For older browsers, use the [web-streams-polyfill](https://www.npmjs.com/package/web-streams-polyfill):

```ts
import 'web-streams-polyfill/polyfill';
import { from, pipe, map } from 'web-streams-extensions';
```

## Development

### Testing

The project includes comprehensive test suites for both Node.js and browser environments:

```bash
# Run Node.js tests
npm test

# Run tests with coverage
npm run test:cover

# Run browser tests (all browsers: Chromium, Firefox, WebKit)
npm run test:browser

# Run tests in specific browsers
npm run test:browser:chromium
npm run test:browser:firefox  
npm run test:browser:webkit

# Run browser tests in watch mode
npm run test:browser:watch

# Run all tests (Node.js + Browser)
npm run test:all
```

### Browser Testing

Browser tests run the same test suite in real browser environments using [Web Test Runner](https://modern-web.dev/docs/test-runner/overview/) and [Playwright](https://playwright.dev/). This ensures that all operators work correctly with real browser implementations of ReadableStreams across **Chromium**, **Firefox**, and **WebKit** engines.

### Build

```bash
# Clean previous builds
npm run clean

# Build for both ESM and CommonJS
npm run build

# Build specific formats
npm run build:esm
npm run build:cjs
```






