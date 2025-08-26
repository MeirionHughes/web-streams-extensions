# mergeAll

Flattens a stream of streams by merging them concurrently. All inner streams are processed simultaneously, and values are emitted as they become available from any inner stream.

## Type Signature

```typescript
function mergeAll<T>(concurrency?: number): (
  src: ReadableStream<ReadableStream<T> | Promise<T> | Iterable<T> | AsyncIterable<T>>, 
  strategy?: QueuingStrategy<T>
) => ReadableStream<T>
```

## Parameters

- `concurrency`: Maximum number of inner streams to process concurrently (default: `Infinity`)
- `strategy`: Optional queuing strategy for backpressure control (default: `{ highWaterMark: 16 }`)

## How It Works

The operator:
1. **Concurrent processing**: Processes multiple inner streams simultaneously
2. **First-come-first-serve**: Emits values as they become available from any inner stream
3. **Order not guaranteed**: Output order depends on timing, not source order
4. **Concurrency control**: Limits number of active inner streams when specified

## Examples

### Basic Concurrent Merging

```typescript
const innerStreams = from([
  timer(100, 100).pipe(take(3), map(i => `A${i}`)),  // A0, A1, A2
  timer(150, 100).pipe(take(3), map(i => `B${i}`)),  // B0, B1, B2  
  timer(200, 100).pipe(take(3), map(i => `C${i}`))   // C0, C1, C2
]);

const result = await toArray(
  pipe(
    innerStreams,
    mergeAll()
  )
);
// Result: ['A0', 'B0', 'C0', 'A1', 'B1', 'C1', 'A2', 'B2', 'C2']
// (Actual order depends on timing)
```

### With Concurrency Limit

```typescript
const manyStreams = from([
  from([1, 2, 3]),
  from([4, 5, 6]),
  from([7, 8, 9]),
  from([10, 11, 12]),
  from([13, 14, 15])
]);

const result = await toArray(
  pipe(
    manyStreams,
    mergeAll(2)  // Only 2 streams active at once
  )
);
// Processes first 2 streams, then next 2, etc.
```

### API Parallel Processing

```typescript
const apiEndpoints = from([
  '/api/users',
  '/api/posts', 
  '/api/comments',
  '/api/tags'
]);

const apiResults = pipe(
  apiEndpoints,
  map(endpoint => 
    from(fetch(endpoint).then(r => r.json()))
  ),
  mergeAll(2)  // Max 2 concurrent API calls
);

// Processes multiple API calls concurrently
```

### File Processing

```typescript
const fileStreams = from([
  'file1.txt',
  'file2.txt',
  'file3.txt'
]).pipe(
  map(filename => 
    from(processFileAsync(filename))
  ),
  mergeAll(3)  // Process all files concurrently
);

// All files processed simultaneously
```

### Mixed Input Types

```typescript
const mixedStreams = from([
  [1, 2, 3],                    // Iterable
  from([4, 5, 6]),             // Stream
  Promise.resolve([7, 8, 9]),   // Promise
  timer(100).pipe(map(() => 10)) // Delayed stream
]);

const result = await toArray(
  pipe(
    mixedStreams,
    mergeAll()
  )
);
// Result: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] (order may vary)
```

### Real-time Data Aggregation

```typescript
const dataSources = pipe(
  from(['sensor1', 'sensor2', 'sensor3']),
  map(sensor => 
    interval(1000).pipe(
      map(reading => ({ sensor, reading, timestamp: Date.now() })),
      take(5)
    )
  ),
  mergeAll()
);

// Combines real-time data from multiple sensors
```

## Key Characteristics

- **Concurrent processing**: All inner streams run simultaneously
- **Non-deterministic order**: Output order depends on timing
- **Concurrency control**: Optional limit on active streams
- **Memory efficient**: Respects backpressure from downstream
- **Type flexibility**: Works with streams, promises, iterables

## Use Cases

- **Parallel API calls**: Process multiple HTTP requests concurrently
- **File I/O**: Read/process multiple files simultaneously  
- **Real-time data**: Merge multiple data streams
- **Performance optimization**: Maximize throughput with parallelism
- **Resource utilization**: Use available resources efficiently

## Comparison with Related Operators

- **`mergeAll`**: Concurrent processing, order not guaranteed
- **`concatAll`**: Sequential processing, maintains order
- **`switchAll`**: Cancels previous when new arrives
- **`exhaustAll`**: Ignores new while current active

## See Also

- [`mergeMap`](./mergeMap.md) - Map and merge in one step
- [`concatAll`](./concatAll.md) - Flatten streams sequentially
- [`switchAll`](./switchAll.md) - Switch to latest stream
- [`exhaustAll`](./exhaustAll.md) - Exhaust current before next