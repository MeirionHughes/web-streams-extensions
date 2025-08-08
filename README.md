# WebStream Extensions

A collection of helper methods for WebStreams, inspired by ReactiveExtensions. 
Being built on-top of ReadableStream, we can have a reactive pipeline with **non-blocking back-pressure built-in**. 

Requires support for ReadableStream ([use a polyfill if not available](https://www.npmjs.com/package/web-streams-polyfill)).

Subjects require support for WritableStream. Requires support for async/await.


## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### 🐛 Reporting Bugs

**Important**: All bug reports must include a reproducible failing test case.

1. Fork the repository
2. Add a failing test to `spec/failing.spec.ts` that reproduces the bug
3. Open a bug report with the test code or link to your fork
4. Follow the [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml)

### Example Bug Report Test

```typescript
it("should handle empty arrays in concat - currently hangs", async () => {
  let input = [[], [1, 2], []];
  let expected = [1, 2];
  
  let result = await toArray(
    pipe(
      from(input),
      concatAll()
    )
  );
  
  expect(result).to.deep.equal(expected);
});
```

This approach ensures we can:
- ✅ Understand the exact issue
- ✅ Verify the bug exists  
- ✅ Ensure our fix works
- ✅ Prevent regressions

## Installation

```bash
npm install web-streams-extensions
```

## Usage

```typescript
import { from, pipe, map, filter, toArray } from 'web-streams-extensions';

// Create a stream from an array
const stream = pipe(
  from([1, 2, 3, 4, 5, 6]),
  filter(x => x % 2 === 0),
  map(x => x * 2)
);

const result = await toArray(stream);
console.log(result); // [4, 8, 12]
```

## API Reference Quick Index

### Creation Functions
- `from()` - Create stream from iterable, async iterable, promise, or function
- `of()` - Create stream from arguments
- `interval()` - Create stream that emits numbers at intervals
- `concat()` - Concatenate multiple streams sequentially
- `zip()` - Combine streams into arrays of corresponding values
- `defer()` - Defer stream creation until read

### Consuming Functions
- `toArray()` - Collect all values into an array
- `toPromise()` - Get the last emitted value
- `toString()` - Combine all chunks into a string
- `subscribe()` - Subscribe with callbacks for next/complete/error

### Pipe Functions
- `pipe()` - Chain operators with backpressure control
- `retryPipe()` - Pipe with retry semantics on error

### Transformation Operators
- `map()` - Transform each value (async supported)
- `mapSync()` - Transform each value (sync only, faster)
- `scan()` - Accumulate with intermediate results
- `reduce()` - Accumulate to final result
- `switchMap()` - Map to streams, switch to latest

### Filtering Operators
- `filter()` - Filter values by predicate
- `distinctUntilChanged()` - Remove consecutive duplicates
- `first()` - Take first value (optionally matching predicate)
- `last()` - Take last value (optionally matching predicate)
- `take()` - Take first N values
- `takeUntil()` - Take until notifier emits
- `skip()` - Skip first N values

### Timing Operators
- `debounceTime()` - Buffer until quiet period
- `throttleTime()` - Limit emission rate
- `timeout()` - Error if no value within duration

### Buffering Operators
- `buffer()` - Buffer into arrays of specified size
- `startWith()` - Prepend values to stream

### Combination Operators
- `concatAll()` - Flatten stream of streams sequentially
- `merge()` - Flatten stream of streams with concurrency control

### Utility Operators
- `tap()` - Observe values without modification
- `on()` - Attach lifecycle callbacks
- `catchError()` - Handle errors with fallback stream
- `schedule()` - Control emission timing with scheduler
- `through()` - Use native TransformStream

### Schedulers
- `IdleScheduler` - Schedule during idle time

### Subjects
- `Subject\<T>` - Multicast stream (hot observable)
- `BehaviourSubject\<T>` - Subject that remembers last value



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

Creates a ReadableStream that emits incremental numbers at specified intervals.

```ts
pipe(
  interval(1000), // Emits 0, 1, 2, 3... every second
  take(5)
)
// Result: [0, 1, 2, 3, 4] over 5 seconds
```

### concat\<T>(...streams: ReadableStream\<T>[]): ReadableStream\<T>

Concatenates several streams together in the order given. Each stream is read to completion before moving to the next.

It will not read from the streams until the result stream is read from (lazy evaluation).

```ts
let inputA = [1, 2];
let inputB = [3, 4];
let stream = concat(from(inputA), from(inputB));
let result = await toArray(stream); // [1, 2, 3, 4]
```

### zip\<T>(sources: ReadableStream\<T>[]): ReadableStream\<T[]>

Combines multiple streams by emitting arrays of corresponding values. Completes when any source stream completes.

```ts
let stream1 = from([1, 2, 3]);
let stream2 = from(['a', 'b', 'c']);
let result = await toArray(zip([stream1, stream2]));
// Result: [[1, 'a'], [2, 'b'], [3, 'c']]
```

### defer\<T>(cb: () => Promise\<ReadableStream\<T>> | ReadableStream\<T>): ReadableStream\<T>

Defers the creation of a ReadableStream until it's actually read from. Useful for lazy initialization.

```ts
let result = await toArray(defer(() => Promise.resolve(from([1, 2, 3, 4]))));
// Result: [1, 2, 3, 4]
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

Given inconsistencies in browser support for anything other than ReadableStream, we opted to make an Operator a function of the form:

`type Op\<T, R> = (src: ReadableStream\<T>) => ReadableStream\<R>`

This only requires ReadableStream to be implemented/available with getReader support. To aid in pipelining these operators, a `pipe` method is available: 

### pipe\<T>(src: ReadableStream\<T>, ...ops: Op[], options?: { highWaterMark?: number }): ReadableStream

Pipes a source stream through a series of operators, creating a transformation pipeline. Each operator transforms the stream in some way. The optional `highWaterMark` parameter controls backpressure (defaults to 1).

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

Synchronous version of map for better performance when no async operations are needed.

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

#### switchMap\<T, R>(project: (value: T, index: number) => ReadableStream\<R>): Op\<T, R>

Maps each source value to a stream and flattens them, but only the most recent inner stream. When a new inner stream is created, the previous one is cancelled.

```ts
// Simulate user typing with debounced search requests
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
// Result: ['abc-result1', 'abc-result2', 'abc-result3']
// Earlier searches for 'a' and 'ab' are cancelled when 'abc' starts
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

### Timing Operators

#### debounceTime\<T>(duration: number): Op\<T, T[]>

Buffers elements until a duration of time has passed since the last chunk, then emits the buffer.

```ts
let stream = pipe(
  from(rapidValueStream),
  debounceTime(1000) // Wait 1 second after last value
);
```

#### throttleTime\<T>(duration: number): Op\<T, T>

Limits the rate of emissions to at most one per specified time period. The first value is emitted immediately, then subsequent values are ignored until the time period expires.

```ts
let result = await toArray(
  pipe(
    interval(100), // Emits every 100ms
    throttleTime(300), // Only emit every 300ms
    take(5)
  )
);
// Will emit values at 0ms, 300ms, 600ms, etc.
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

#### concatAll\<T>(): Op\<ReadableStream\<T>, T>

Given a ReadableStream of ReadableStreams, concatenates the output of each stream in sequence.

```ts
let streams = [from([1, 2]), from([3, 4]), from([5])];
let result = await toArray(
  pipe(
    from(streams),
    concatAll()
  )
);
// Result: [1, 2, 3, 4, 5]
```

#### merge\<T>(concurrent?: number): Op\<ReadableStream\<T> | Promise\<T>, T>

Merges a stream of streams (or promises) into a single flattened stream, with optional concurrency control. Each inner stream is subscribed to and their values are merged into the output stream.

```ts
let streams = [from([1, 2]), from([3, 4]), Promise.resolve(5)];
let result = await toArray(
  pipe(
    from(streams),
    merge(2) // Process max 2 streams at once
  )
);
// Result: [1, 2, 3, 4, 5] (order may vary based on timing)
```

### Utility Operators

#### tap\<T>(cb: (chunk: T) => void | Promise\<void>): Op\<T, T>

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

#### on\<T>(callbacks: { start?(): void; complete?(): void; error?(err: any): void }): Op\<T, T>

Creates an operator that allows attaching lifecycle callbacks to a stream. Useful for side effects like logging, cleanup, or state management without modifying the stream's data flow.

```ts
let result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    on({
      start: () => console.log('Stream started'),
      complete: () => console.log('Stream completed'),
      error: (err) => console.error('Stream error:', err)
    })
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

#### schedule\<T>(scheduler: Scheduler): Op\<T, T>

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

## Schedulers

Schedulers control when and how stream operations are executed, allowing for better performance and resource management.

### IdleScheduler

A scheduler that uses `requestIdleCallback` when available (in browser environments), falling back to `setTimeout` for compatibility with Node.js and older browsers. Yields control during idle periods, allowing other tasks to run.

```ts
import { IdleScheduler, schedule } from 'web-streams-extensions';
// or
import { IdleScheduler } from 'web-streams-extensions/schedulers';

const idleScheduler = new IdleScheduler();

let result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    schedule(idleScheduler) // Process values during idle time
  )
);
```

## Advanced Usage

### Custom Schedulers

You can create custom schedulers by implementing the `IScheduler` interface:

```ts
import { IScheduler, schedule } from 'web-streams-extensions';

class CustomScheduler implements IScheduler {
  async nextTick(): Promise<void> {
    // Custom scheduling logic
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

const customScheduler = new CustomScheduler();
```

### Error Handling Patterns

```ts
// Comprehensive error handling with retries and fallbacks
const robustStream = retryPipe(
  () => fetchDataStream(),
  map(data => processData(data)),
  catchError(err => {
    console.error('Processing failed:', err);
    return from(['fallback-data']);
  }),
  { retries: 3, delay: 1000 }
);
```

### Performance Optimization

```ts
// Use appropriate highWaterMark for your use case
const highThroughputStream = pipe(
  from(largeDataSet),
  mapSync(x => x * 2), // Sync version is faster when possible
  buffer(100), // Batch processing
  { highWaterMark: 64 } // Higher buffer for better throughput
);

// Use backpressure-aware processing
const backpressureStream = pipe(
  from(asyncDataSource),
  map(async data => {
    // This will naturally backpressure if processing is slow
    return await expensiveAsyncOperation(data);
  })
);
```

## Subjects

Subjects are duplex streams that act as both readable and writable streams with automatic tee'ing of the readable side. Each access to `subject.readable` returns a _new_ ReadableStream\<T> that will receive all subsequent values.

### Subject\<T>

A Subject is a special type of stream that allows values to be multicast to many observers. It implements both readable and writable streams with proper backpressure handling.

**Key features:**
- Each call to `.readable` returns a new ReadableStream
- Values can be pushed via `.writable` or directly via `.next()`
- Automatic resource cleanup and error handling
- Full Web Streams compatibility

**Properties:**
```ts
readonly readable: ReadableStream\<T>;  // Creates a new readable stream
readonly writable: WritableStream\<T>;  // Writable side for piping
readonly closed: boolean;              // Whether the subject is closed
```

**Methods:**
```ts
next(value: T): Promise\<number>;       // Push a value directly
complete(): Promise\<void>;             // Complete the subject
error(err: any): Promise\<void>;        // Error the subject
subscribe(subscriber): SubscriptionLike; // Subscribe with callbacks
```

**Example usage:**

```ts
import { Subject, pipe, map, filter, toArray } from 'web-streams-extensions';

// Create a subject
const subject = new Subject\<number>();

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
const subject = new Subject\<number>();

// Pipe source to subject
source.pipeTo(subject.writable);

// Read from subject
const result = await toArray(subject.readable);
console.log(result); // [1, 2, 3, 4]
```

**pipeThrough` the subject:**

```ts
let input = [1, 2, 3, 4];
let subject = new Subject\<number>();

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

## Error Handling

All operators and functions include proper error handling with resource cleanup:

```ts
try {
  const result = await toArray(
    pipe(
      from(mightThrowSource),
      map(x => x.riskyOperation()),
      timeout(5000)
    )
  );
} catch (error) {
  console.error('Stream error:', error);
  // All resources are automatically cleaned up
}
```

## Backpressure

The library properly handles backpressure throughout the pipeline:

```ts
// Slow consumer will naturally backpressure the fast producer
const slowStream = pipe(
  from(fastProducer()),
  map(async x => {
    await sleep(100); // Slow async operation
    return x;
  })
);
```

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





