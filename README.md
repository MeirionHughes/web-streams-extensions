# WebStream Extensions

A collection of helper methods for WebStreams, inspired by ReactiveExtensions. 
Being built on-top of ReadableStream, we can have a reactive pipeline with **non-blocking back-pressure built-in**. 

Requires support for ReadableStream ([use a polyfill if not available](https://www.npmjs.com/package/web-streams-polyfill)).

Subjects require support for WritableStream. Requires support for async/await.

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

## Creation

### from<T>(src: Iterable<T> | AsyncIterable<T> | (() => Iterable<T> | AsyncIterable<T>) | ReadableLike<T>): ReadableStream<T>

Creates a ReadableStream from various input sources. Supports iterables, async iterables, promises, functions returning iterables, and ReadableLike objects.

It will not create an iterator until the resulting stream is read from (lazy evaluation).

```ts
from([1, 2, 3, 4])
from(function*() { yield 1; yield 2; yield 3; yield 4; })
from(async function*() { yield 1; yield 2; yield 3; yield await Promise.resolve(4); })
from(Promise.resolve([1, 2, 3, 4]))
```

### of<T>(...args: T[]): ReadableStream<T>

Creates a ReadableStream where the chunks will be the in-order arguments passed to it.

```ts
of(1, "foo", () => "bar", {})
// Emits: 1, "foo", () => "bar", {}
```

### concat<T>(...streams: ReadableStream<T>[]): ReadableStream<T>

Concatenates several streams together in the order given. Each stream is read to completion before moving to the next.

It will not read from the streams until the result stream is read from (lazy evaluation).

```ts
let inputA = [1, 2];
let inputB = [3, 4];
let expected = [1, 2, 3, 4];
let stream = concat(from(inputA), from(inputB));
let result = await toArray(stream);
```

### defer<T>(cb: () => Promise<ReadableStream<T>> | ReadableStream<T>): ReadableStream<T>

Defers the creation of a ReadableStream until it's actually read from. Useful for lazy initialization.

```ts
let input = [1, 2, 3, 4];
let expected = [1, 2, 3, 4];

let result = await toArray(defer(() => Promise.resolve(from(input))));
```



## Consuming

### toArray<T>(src: ReadableStream<T>): Promise<T[]>

Consumes a ReadableStream and returns all values as an array. The stream will be read to completion.

```ts
let input = [1, 2, 3, 4];
let expected = [1, 2, 3, 4];
let result = await toArray(from([1, 2, 3, 4]));
```

### toPromise<T>(src: ReadableStream<T>): Promise<T>

Consumes a ReadableStream and returns the last value emitted. The stream will be read to completion.

```ts
let input = [1, 2, 3, 4];
let expected = 4;
let result = await toPromise(from([1, 2, 3, 4]));
```

### subscribe<T>(src, next, complete?, error?): SubscriptionLike

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

`type Op<T, R> = (src: ReadableStream<T>) => ReadableStream<R>`

This only requires ReadableStream to be implemented/available with getReader support. To aid in pipelining these operators, a `pipe` method is available: 

### pipe<T>(src: ReadableStream<T>, ...ops: Op[]): ReadableStream

Pipes a source stream through a series of operators, creating a transformation pipeline. Each operator transforms the stream in some way.

```ts
let input = [1, 2, 3, 4];
let expected = { "1": 1, "2": 2, "4": 4 };

let result = await toPromise(
  pipe(
    from(input),
    filter(x => x != 3),
    buffer(Infinity),
    map(x => {
      return x.reduce((p, c) => { p[c.toString()] = c; return p }, {});
    }),
    first()
  ));
```

## Operators

### buffer<T>(count: number, highWaterMark?: number): Op<T, T[]>

Buffers elements and emits them as arrays when the buffer reaches the specified count. The final buffer (if not empty) is emitted when the source stream completes.

```ts
let input = [1, 2, 3, 4];
let expected = [[1, 2], [3, 4]];
let stream = pipe(from(input), buffer(2));
let result = await toArray(stream);
```

### concatAll<T>(): Op<ReadableStream<T>, T>

Given a ReadableStream of ReadableStreams, concatenates the output of each stream in sequence.

```ts
let input = [from([1, 2]), from([3, 4]), from([5])];
let expected = [1, 2, 3, 4, 5];
let stream = pipe(from(input), concatAll());
let result = await toArray(stream);
```

### filter<T>(predicate: (chunk: T) => boolean): Op<T, T>

Filters out chunks that fail a predicate test. Only values that pass the predicate are emitted.

```ts
let input = [1, 2, 3, 4];
let expected = [1, 2, 4];
let stream = pipe(from(input), filter(x => x != 3));
let result = await toArray(stream);

```

### first<T>(predicate?:(chunk:T)=>boolean): Op<T, T>

returns a stream of one chunk, the first to return true when passed to the selector, or simply the first if no predicate is supplied

```ts
let input = [1,2,3,4];
let expected = 3;
let stream = first(x=>x>=3)(from(input));
let result = await toPromise(stream);
```

### last<T>(predicate?:(chunk:T)=>boolean): Op<T, T>

### map<T, R>(select: (chunk: T) => R | Promise<R>): Op<T, R>

Maps each value in a stream through a selector function. Values where the selector returns undefined are filtered out.

```ts
let input = [1, 2, 3, 4];
let expected = [2, 4, 6, 8];
let stream = pipe(from(input), map(x => x * 2));
let result = await toArray(stream);
```

### first<T>(selector?: (chunk: T) => boolean): Op<T, T>

Emits only the first value that matches the selector, then completes. If no selector is provided, emits the first value.

```ts
let input = [1, 2, 3, 4];
let expected = [2];
let stream = pipe(from(input), first(x => x % 2 === 0));
let result = await toArray(stream);
```

### last<T>(selector?: (chunk: T) => boolean): Op<T, T>

Emits only the last value that matches the selector. If no selector is provided, emits the last value. The stream must complete for the last value to be emitted.

```ts
let input = [1, 2, 3, 4];
let expected = [3];
let stream = pipe(from(input), last(x => x < 4));
let result = await toArray(stream);
```

### skip<T>(count: number): Op<T, T>

Skips the first `count` elements and then streams the rest to the output.

```ts
let input = [1, 2, 3, 4, 5];
let expected = [3, 4, 5];
let stream = pipe(from(input), skip(2));
let result = await toArray(stream);
```

### take<T>(count: number): Op<T, T>

Takes only the first `count` elements, then completes the stream.

```ts
let input = [1, 2, 3, 4, 5];
let expected = [1, 2];
let stream = pipe(from(input), take(2));
let result = await toArray(stream);
```

### timeout<T>(duration: number): Op<T, T>

Emits an error if the duration waiting for a chunk exceeds the specified timeout in milliseconds.

```ts
let stream = pipe(
  from(slowAsyncGenerator()),
  timeout(5000) // Error if no value within 5 seconds
);
```

### debounceTime<T>(duration: number): Op<T, T[]>

Buffers elements until a duration of time has passed since the last chunk, then emits the buffer.

```ts
let stream = pipe(
  from(rapidValueStream),
  debounceTime(1000) // Wait 1 second after last value
);
```

### tap<T>(cb: (chunk: T) => void | Promise<void>): Op<T, T>

Allows observing each chunk without modifying the stream. The output is exactly the same as the input.

```ts
let input = [1, 2, 3, 4];
let expected = [1, 2, 3, 4];
let sideEffects = [];
let stream = pipe(
  from(input), 
  tap(x => sideEffects.push(x))
);
let result = await toArray(stream);
```

### timeout<T>(duration: number): Op<T, T>

throws an error if the duration between chunks exceeds the duration (milliseconds)


## Subjects

Subjects are duplex streams that act as both readable and writable streams with automatic tee'ing of the readable side. Each access to `subject.readable` returns a _new_ ReadableStream<T> that will receive all subsequent values.

### Subject<T>

A Subject is a special type of stream that allows values to be multicast to many observers. It implements both readable and writable streams with proper backpressure handling.

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

**Piping to a subject:**

```ts
const source = from([1, 2, 3, 4]);
const subject = new Subject<number>();

// Pipe source to subject
source.pipeTo(subject.writable);

// Read from subject
const result = await toArray(subject.readable);
console.log(result); // [1, 2, 3, 4]
```

### BehaviourSubject<T>

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


```ts
let input = [1, 2, 3, 4];
let subject = new Subject<number>();

let resultPromise = toArray(subject.readable);

from(input).pipeTo(subject.writable);

let result = await resultPromise;//[1,2,3,4]
```

or `pipeThrough` the subject: 

```ts
let input = [1, 2, 3, 4];
let subject = new Subject<number>();

let result = await toArray(from(input).pipeThrough(subject));

expect(result).to.be.deep.eq(expected); // [1,2,3,4]
```

or manually call `next`, `complete`, `error`

```ts
let subject = new Subject<number>();
let resultPromise = toArray(subject.readable);

subject.next(1);
subject.next(2);
subject.next(3);
subject.next(4);
subject.complete();

let result = await resultPromise; // [1,2,3,4]
```

although mixing these approaches is not advised - unpredictable behavior. 





