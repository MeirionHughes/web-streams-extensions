
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