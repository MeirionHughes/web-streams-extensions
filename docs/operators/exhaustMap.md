# exhaustMap

Maps each source value to a stream, promise, iterable, or async iterable, but ignores new source values while the current inner stream is still active. Only processes the next value after the current inner stream completes.

## Type Signature

```typescript
interface ExhaustMapProjector<T, R> {
  (value: T, index: number, signal?: AbortSignal): 
    ReadableStream<R> | Promise<R> | Iterable<R> | AsyncIterable<R>;
}

function exhaustMap<T, R>(
  project: ExhaustMapProjector<T, R>
): (src: ReadableStream<T>, strategy?: QueuingStrategy<R>) => ReadableStream<R>
```

## Parameters

- `project`: Function that maps each source value to a stream-like object. Receives:
  - `value`: The current value from the source
  - `index`: The index of processed values (ignored values don't increment)
  - `signal`: An `AbortSignal` for cancellation support

## Examples

### Basic Exhaustion Behavior

```typescript
// Simulate rapid source emissions
const result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    exhaustMap(n => from([n * 10, n * 20]))
  )
);
// Input:   1---2---3---4---|
// Inner 1: 10--20|  (2, 3, 4 ignored while processing)
// Output:  10--20|
// Result: [10, 20] (only first value processed)
```

### Button Click Debouncing

```typescript
// Prevent multiple API calls from rapid button clicks
const buttonClicks = from(['click1', 'click2', 'click3', 'click4']);

const apiResults = pipe(
  buttonClicks,
  exhaustMap(async (click, index, signal) => {
    // Simulate API call
    await delay(200);
    if (signal?.aborted) return [];
    return [`API result for ${click}`];
  })
);

const result = await toArray(apiResults);
// Only processes first click, ignores others until API call completes
// Result: ['API result for click1']
```

### File Upload Protection

```typescript
const fileSelections = from([file1, file2, file3]);

const uploadStatus = pipe(
  fileSelections,
  exhaustMap((file, index, signal) => {
    return new ReadableStream({
      start(controller) {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.onprogress = (event) => {
          if (!signal?.aborted && event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            controller.enqueue(`${file.name}: ${progress}%`);
          }
        };
        
        xhr.onload = () => {
          if (!signal?.aborted) {
            controller.enqueue(`${file.name}: Upload complete`);
            controller.close();
          }
        };
        
        xhr.onerror = () => {
          controller.error(new Error(`Upload failed: ${file.name}`));
        };
        
        // Handle cancellation
        signal?.addEventListener('abort', () => {
          xhr.abort();
          controller.close();
        });
        
        // Start upload
        const formData = new FormData();
        formData.append('file', file);
        xhr.open('POST', '/upload');
        xhr.send(formData);
      }
    });
  })
);

// Only one file uploads at a time, subsequent selections ignored during upload
```

### Search with Request Protection

```typescript
const searchQueries = from(['a', 'ab', 'abc', 'abcd']);

const searchResults = pipe(
  searchQueries,
  exhaustMap((query, index, signal) =>
    fetch(`/api/search?q=${query}`, { signal })
      .then(response => response.json())
      .then(data => from(data.results))
  )
);

// Only first search executes, others ignored until first completes
// Prevents overlapping search requests
```

### Game Action Processing

```typescript
const playerActions = from(['jump', 'jump', 'attack', 'jump', 'run']);

const gameEvents = pipe(
  playerActions,
  exhaustMap(action => {
    // Each action takes time to complete
    switch (action) {
      case 'jump':
        return timer(500).pipe(map(() => 'jump-completed'));
      case 'attack':
        return timer(300).pipe(map(() => 'attack-completed'));
      case 'run':
        return timer(200).pipe(map(() => 'run-completed'));
      default:
        return from(['unknown-action']);
    }
  })
);

// Only processes actions that aren't interrupted by new ones
// Prevents action spam/animation interruption
```

### Working with Iterables

```typescript
const result = await toArray(
  pipe(
    from(['a', 'b', 'c', 'd']),
    exhaustMap(letter => [letter, letter.toUpperCase(), letter.repeat(2)])
  )
);
// Input:  a---b---c---d---|
// Output: a-A-aa|  (b, c, d ignored while processing 'a')
// Result: ['a', 'A', 'aa']
```

### Database Transaction Protection

```typescript
const transactionRequests = from([
  { type: 'transfer', amount: 100 },
  { type: 'transfer', amount: 50 },  // Ignored
  { type: 'deposit', amount: 200 },  // Ignored
  { type: 'withdraw', amount: 75 }   // Ignored
]);

const transactionResults = pipe(
  transactionRequests,
  exhaustMap(async (request, index, signal) => {
    // Simulate database transaction
    await delay(1000);
    if (signal?.aborted) return [];
    
    return [`Transaction ${request.type} for $${request.amount} completed`];
  })
);

// Only processes first transaction, protects against rapid submissions
```

### Error Handling

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    exhaustMap(n => {
      if (n === 1) {
        return throwError(new Error('Processing error'));
      }
      return from([n * 10]);
    }),
    catchError(err => from(['error-handled']))
  )
);
// First value causes error, others are never processed
// Result: ['error-handled']
```

### Timing-dependent Behavior

```typescript
// Create a stream with timing gaps
const timedSource = new ReadableStream({
  start(controller) {
    controller.enqueue(1);
    setTimeout(() => controller.enqueue(2), 50);  // During processing
    setTimeout(() => controller.enqueue(3), 150); // After processing
    setTimeout(() => controller.close(), 200);
  }
});

const result = await toArray(
  pipe(
    timedSource,
    exhaustMap(n => timer(100).pipe(map(() => n * 10)))
  )
);
// Input timing: 1--2-----3|  (2 arrives during processing of 1)
// Processing:   1--(ignored 2)--3
// Result: [10, 30] (2 is ignored, 3 is processed after 1 completes)
```

## Key Characteristics

- **Exhaustion behavior**: Ignores new values while processing current inner stream
- **No queuing**: Dropped values are completely ignored, not queued
- **Index accuracy**: Only processed values increment the index counter
- **Resource protection**: Prevents overlapping operations
- **Cancellation support**: Proper cleanup via AbortSignal

## When to Use

- **Preventing double-clicks**: UI interactions that shouldn't overlap
- **Rate limiting**: Protecting backend resources from rapid requests
- **Animation control**: Preventing animation interruption
- **File operations**: Single file processing without conflicts
- **Game mechanics**: Preventing action spam
- **Transaction safety**: Database operations that must complete individually

## Comparison with Other Operators

- **vs `switchMap`**: `exhaustMap` ignores new values; `switchMap` cancels and switches
- **vs `concatMap`**: `exhaustMap` ignores; `concatMap` queues all values
- **vs `mergeMap`**: `exhaustMap` ignores; `mergeMap` processes all concurrently

## See Also

- [`switchMap`](./switchMap.md) - Switch to latest inner stream
- [`concatMap`](./concatMap.md) - Process all values sequentially  
- [`mergeMap`](./mergeMap.md) - Process all values concurrently
- [`debounceTime`](./debounceTime.md) - Ignore rapid emissions by timing