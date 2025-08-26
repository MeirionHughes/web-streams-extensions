# concatAll

Flattens a stream of streams by concatenating them sequentially. Each inner stream is fully consumed before moving to the next one.

## Type Signature

```typescript
function concatAll<T>(): (
  src: ReadableStream<ReadableStream<T> | Promise<T> | Iterable<T> | AsyncIterable<T>>, 
  strategy?: QueuingStrategy<T>
) => ReadableStream<T>
```

## Parameters

- No parameters required
- `strategy`: Optional queuing strategy for backpressure control (default: `{ highWaterMark: 16 }`)

## How It Works

The operator:
1. **Sequential processing**: Processes inner streams one at a time, in order
2. **Full consumption**: Each inner stream is read to completion before starting the next
3. **Flexible inputs**: Accepts streams, promises, iterables, or async iterables
4. **Maintains order**: Output values maintain the order of their source streams

## Examples

### Basic Stream Concatenation

```typescript
const innerStreams = from([
  from([1, 2, 3]),
  from([4, 5, 6]),
  from([7, 8, 9])
]);

const result = await toArray(
  pipe(
    innerStreams,
    concatAll()
  )
);
// Result: [1, 2, 3, 4, 5, 6, 7, 8, 9]
```

### With Promises

```typescript
const promiseStream = from([
  Promise.resolve([1, 2]),
  Promise.resolve([3, 4]),
  Promise.resolve([5, 6])
]);

const result = await toArray(
  pipe(
    promiseStream,
    concatAll()
  )
);
// Result: [1, 2, 3, 4, 5, 6]
```

### With Mixed Types

```typescript
const mixedStream = from([
  [1, 2],                    // Iterable
  from([3, 4]),             // Stream
  Promise.resolve([5, 6])    // Promise
]);

const result = await toArray(
  pipe(
    mixedStream,
    concatAll()
  )
);
// Result: [1, 2, 3, 4, 5, 6]
```

### File Processing Example

```typescript
const fileStreams = from([
  'file1.txt',
  'file2.txt', 
  'file3.txt'
]).pipe(
  map(filename => fetch(filename).then(r => r.body)),
  concatAll()
);

// Processes files sequentially, not concurrently
```

## Key Characteristics

- **Sequential**: Processes one inner stream at a time
- **Order preservation**: Maintains the order of inner streams
- **Backpressure handling**: Respects downstream consumer speed
- **Type flexibility**: Works with various async data sources
- **Memory efficient**: Only holds one active inner stream at a time

## Use Cases

- **File processing**: Process multiple files in sequence
- **API pagination**: Handle paginated API responses sequentially  
- **Data transformation**: Transform arrays of data streams
- **Resource management**: Ensure only one resource is accessed at a time

## Comparison with Related Operators

- **`concatAll`**: Sequential processing, maintains order
- **`mergeAll`**: Concurrent processing, order not guaranteed
- **`switchAll`**: Cancels previous stream when new one arrives
- **`exhaustAll`**: Ignores new streams while current is active

## See Also

- [`concatMap`](./concatMap.md) - Map and concatenate in one step
- [`mergeAll`](./mergeAll.md) - Flatten streams concurrently
- [`switchAll`](./switchAll.md) - Switch to latest stream
- [`exhaustAll`](./exhaustAll.md) - Exhaust current before next