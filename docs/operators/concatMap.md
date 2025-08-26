# concatMap

Maps each source value to a stream, promise, iterable, or async iterable and concatenates them sequentially. Each inner source completes before the next one starts, preserving the order of emissions.

## Type Signature

```typescript
interface ConcatMapProjector<T, R> {
  (value: T, index: number, signal?: AbortSignal): 
    ReadableStream<R> | Promise<R> | Iterable<R> | AsyncIterable<R>;
}

function concatMap<T, R>(
  project: ConcatMapProjector<T, R>
): (src: ReadableStream<T>, strategy?: QueuingStrategy<R>) => ReadableStream<R>
```

## Parameters

- `project`: Function that maps each source value to a stream-like object. Receives:
  - `value`: The current value from the source
  - `index`: The index of the current value
  - `signal`: An `AbortSignal` for cancellation support

## Examples

### Basic Sequential Processing

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3]),
    concatMap(n => from([n * 10, n * 20]))
  )
);
// Input:   1-------2-------3-------|
// Inner 1: 10--20--|
// Inner 2:         20--40--|
// Inner 3:                 30--60--|
// Output:  10--20--20--40--30--60--|
// Result: [10, 20, 20, 40, 30, 60]
```

### Working with Arrays (Iterables)

```typescript
const result = await toArray(
  pipe(
    from(['a', 'b', 'c']),
    concatMap(letter => [letter, letter.toUpperCase()])
  )
);
// Input:  a-------b-------c-------|
// Output: a-A-----b-B-----c-C-----|
// Result: ['a', 'A', 'b', 'B', 'c', 'C']
```

### Working with Promises

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3]),
    concatMap(async n => {
      await delay(100);
      return n * 2;
    })
  )
);
// Input:  1-------2-------3-------|
// Output: ----2-------4-------6---|
// Result: [2, 4, 6] (each waits for previous to complete)
```

### Sequential HTTP Requests

```typescript
const urls = ['api/data/1', 'api/data/2', 'api/data/3'];

const result = await toArray(
  pipe(
    from(urls),
    concatMap((url, index, signal) =>
      fetch(url, { signal })
        .then(response => response.json())
        .then(data => from([data]))
    )
  )
);
// Requests are made sequentially, one after another
// Result: [data1, data2, data3] (in order)
```

### File Processing Pipeline

```typescript
const filenames = ['file1.txt', 'file2.txt', 'file3.txt'];

const processedFiles = pipe(
  from(filenames),
  concatMap(async filename => {
    const content = await readFile(filename);
    const lines = content.split('\n');
    return from(lines.filter(line => line.trim())); // Return stream of lines
  })
);

const result = await toArray(processedFiles);
// Files are processed sequentially, lines from each file in order
```

### Custom Iterables

```typescript
const result = await toArray(
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
// Input:  1-------2-------|
// Output: 1-2-3---2-4-6---|
// Result: [1, 2, 3, 2, 4, 6]
```

### Async Iterables

```typescript
async function* generateValues(base: number) {
  for (let i = 1; i <= 3; i++) {
    await delay(50);
    yield base * i;
  }
}

const result = await toArray(
  pipe(
    from([10, 20]),
    concatMap(n => generateValues(n))
  )
);
// Input:  10------20------|
// Output: 10-20-30-20-40-60|
// Result: [10, 20, 30, 20, 40, 60]
```

### Error Handling with Sequential Processing

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    concatMap(n => {
      if (n === 3) {
        return throwError(new Error('Failed at 3'));
      }
      return from([n * 10]);
    }),
    catchError(err => from(['error-handled']))
  )
);
// Input:  1---2---3---4---|
// Output: 10--20--error-handled|
// Result: [10, 20, 'error-handled'] (error stops processing)
```

## Key Characteristics

- **Sequential execution**: Inner streams complete one at a time, in order
- **Order preservation**: Output maintains the order of input values
- **Backpressure**: Respects backpressure from downstream consumers
- **Cancellation support**: AbortSignal allows proper cleanup of ongoing operations
- **Versatile input**: Handles streams, promises, iterables, and async iterables

## Comparison with Other Operators

- **vs `switchMap`**: `concatMap` processes all inner streams sequentially; `switchMap` cancels previous when new arrives
- **vs `mergeMap`**: `concatMap` processes sequentially; `mergeMap` processes concurrently
- **vs `exhaustMap`**: `concatMap` processes all; `exhaustMap` ignores new while processing

## Common Use Cases

- **Sequential API calls**: When requests must complete in order
- **File processing**: Processing files one at a time
- **Database transactions**: Sequential database operations
- **Animation sequences**: UI animations that must complete in order
- **Dependent operations**: When next operation depends on previous completion

## See Also

- [`switchMap`](./switchMap.md) - Switch to latest inner stream
- [`mergeMap`](./mergeMap.md) - Process inner streams concurrently
- [`exhaustMap`](./exhaustMap.md) - Ignore new while processing
- [`concatAll`](./concatAll.md) - Flatten stream of streams sequentially