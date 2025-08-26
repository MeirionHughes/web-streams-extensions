# exhaustAll

Flattens a stream of streams by ignoring new inner streams while the current one is still active. Only processes the next inner stream after the current one completes.

## Type Signature

```typescript
function exhaustAll<T>(): (
  src: ReadableStream<ReadableStream<T> | Promise<T> | Iterable<T> | AsyncIterable<T>>, 
  strategy?: QueuingStrategy<T>
) => ReadableStream<T>
```

## Parameters

- No parameters required
- `strategy`: Optional queuing strategy for backpressure control (default: `{ highWaterMark: 16 }`)

## How It Works

The operator:
1. **Exhaust current**: Fully processes the current inner stream
2. **Ignore while active**: Drops any new inner streams that arrive while processing
3. **Next after completion**: Only starts the next available inner stream after current completes
4. **Sequential but selective**: Unlike `concatAll`, skips inner streams that arrived during processing

## Examples

### Basic Exhaust Behavior

```typescript
// Simulate streams arriving over time
const innerStreams = from(async function*() {
  yield from([1, 2, 3]);      // First stream - will be processed
  await sleep(10);
  yield from([4, 5, 6]);      // Arrives while first is active - ignored
  await sleep(10);
  yield from([7, 8, 9]);      // Arrives while first is active - ignored
  await sleep(100);           // Wait for first to complete
  yield from([10, 11, 12]);   // Next stream - will be processed
}());

const result = await toArray(
  pipe(
    innerStreams,
    exhaustAll()
  )
);
// Result: [1, 2, 3, 10, 11, 12] - middle streams were ignored
```

### Rate Limiting Example

```typescript
const apiRequests = pipe(
  interval(100),  // Request every 100ms
  map(i => fetch(`/api/data/${i}`).then(r => r.json())),
  exhaustAll()    // Ignore new requests while one is processing
);

// Only processes one API request at a time, dropping excess requests
```

### User Interaction Example

```typescript
const buttonClicks = from([
  'click1', 'click2', 'click3', 'click4'
]);

const expensiveOperations = pipe(
  buttonClicks,
  map(click => from(async function*() {
    // Simulate expensive async operation
    yield `processing-${click}`;
    await sleep(1000);
    yield `complete-${click}`;
  }())),
  exhaustAll()
);

// Only processes first click, ignores subsequent clicks until complete
// Result: ['processing-click1', 'complete-click1']
```

### Search Debouncing

```typescript
const searchQueries = from(['a', 'ab', 'abc', 'abcd']);

const searchResults = pipe(
  searchQueries,
  map(query => 
    from(async function*() {
      yield `searching-${query}`;
      const results = await searchAPI(query);
      yield* results;
    }())
  ),
  exhaustAll()
);

// Only searches for 'a', ignores 'ab', 'abc', 'abcd' until 'a' completes
```

## Key Characteristics

- **Selective processing**: Ignores inner streams that arrive while current is active
- **Resource protection**: Prevents overwhelming system with too many concurrent operations
- **First-wins strategy**: Processes the first available inner stream completely
- **Memory efficient**: Only processes one inner stream at a time
- **Drop behavior**: Silently drops ignored inner streams

## Use Cases

- **API rate limiting**: Prevent overwhelming servers with concurrent requests
- **User interaction**: Ignore rapid button clicks/inputs while processing
- **Resource-intensive operations**: Prevent multiple expensive operations
- **Animation/rendering**: Skip frames when system is busy
- **File processing**: Process one file completely before starting next

## Comparison with Related Operators

- **`exhaustAll`**: Ignores new while current is active
- **`concatAll`**: Queues all inner streams for sequential processing  
- **`mergeAll`**: Processes all inner streams concurrently
- **`switchAll`**: Cancels current when new stream arrives

## See Also

- [`exhaustMap`](./exhaustMap.md) - Map and exhaust in one step
- [`concatAll`](./concatAll.md) - Process all streams sequentially
- [`mergeAll`](./mergeAll.md) - Process all streams concurrently
- [`switchAll`](./switchAll.md) - Switch to latest stream