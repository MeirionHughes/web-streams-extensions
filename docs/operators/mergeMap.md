# mergeMap

Maps each source value to a stream, promise, iterable, or async iterable and merges them concurrently with optional concurrency control. Unlike `concatMap`, inner streams can emit values simultaneously, so order is not guaranteed.

## Type Signature

```typescript
interface MergeMapProjector<T, R> {
  (value: T, index: number, signal?: AbortSignal): 
    ReadableStream<R> | Promise<R> | Iterable<R> | AsyncIterable<R>;
}

function mergeMap<T, R>(
  project: MergeMapProjector<T, R>,
  concurrent?: number
): (src: ReadableStream<T>, strategy?: QueuingStrategy<R>) => ReadableStream<R>
```

## Parameters

- `project`: Function that maps each source value to a stream-like object. Receives:
  - `value`: The current value from the source
  - `index`: The index of the current value  
  - `signal`: An `AbortSignal` for cancellation support
- `concurrent`: Maximum number of inner streams to process simultaneously (default: `Infinity`)

## Examples

### Basic Concurrent Processing

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3]),
    mergeMap(n => from([n * 10, n * 20]))
  )
);
// Input:   1---2---3---|
// Inner 1: 10-20|
// Inner 2:     20-40|
// Inner 3:         30-60|
// Output:  10-20-20-40-30-60| (order may vary)
// Possible results: [10, 20, 20, 40, 30, 60] or [10, 20, 30, 20, 40, 60]
```

### Concurrent HTTP Requests

```typescript
const urls = ['api/fast', 'api/slow', 'api/medium'];

const result = await toArray(
  pipe(
    from(urls),
    mergeMap((url, index, signal) =>
      fetch(url, { signal })
        .then(response => response.json())
        .then(data => from([data]))
    )
  )
);
// All requests start immediately and complete as they finish
// Result order depends on response times, not input order
```

### Concurrency Limiting

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4, 5]),
    mergeMap(
      async n => {
        await delay(100); // Simulate work
        return n * 2;
      },
      2 // Max 2 concurrent operations
    )
  )
);
// Only 2 operations run simultaneously
// Input:  1-2-3-4-5|
// Slots:  [1,2]--[3,4]--[5]
// Output: --2,4----6,8----10| (timing depends on concurrency)
```

### Processing File Uploads

```typescript
const files = from(selectedFiles);

const uploadResults = pipe(
  files,
  mergeMap(
    (file, index, signal) => {
      return new ReadableStream({
        start(controller) {
          const xhr = new XMLHttpRequest();
          
          xhr.upload.onprogress = (event) => {
            if (!signal?.aborted && event.lengthComputable) {
              const progress = (event.loaded / event.total) * 100;
              controller.enqueue(`${file.name}: ${progress}%`);
            }
          };
          
          xhr.onload = () => {
            if (!signal?.aborted) {
              controller.enqueue(`${file.name}: Complete`);
              controller.close();
            }
          };
          
          xhr.onerror = () => controller.error(new Error(`Upload failed: ${file.name}`));
          
          signal?.addEventListener('abort', () => {
            xhr.abort();
            controller.close();
          });
          
          const formData = new FormData();
          formData.append('file', file);
          xhr.open('POST', '/upload');
          xhr.send(formData);
        }
      });
    },
    3 // Max 3 concurrent uploads
  )
);

// Multiple files upload simultaneously with progress updates
```

### Database Queries with Concurrent Limits

```typescript
const userIds = from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

const userDetails = pipe(
  userIds,
  mergeMap(
    async (id, index, signal) => {
      // Check if operation was cancelled
      if (signal?.aborted) return [];
      
      const user = await fetchUser(id);
      const posts = await fetchUserPosts(id);
      
      return [{
        ...user,
        postCount: posts.length
      }];
    },
    3 // Max 3 concurrent database operations
  )
);

const result = await toArray(userDetails);
// Processes user data with controlled concurrency
```

### Working with Iterables

```typescript
const result = await toArray(
  pipe(
    from(['a', 'b', 'c']),
    mergeMap(letter => [letter, letter.toUpperCase(), letter.repeat(2)])
  )
);
// Input:  a---b---c---|
// Output: a,A,aa-b,B,bb-c,C,cc| (may interleave)
// Possible result: ['a', 'A', 'aa', 'b', 'B', 'bb', 'c', 'C', 'cc']
```

### Real-time Data Processing

```typescript
const stockSymbols = from(['AAPL', 'GOOGL', 'MSFT', 'TSLA']);

const stockUpdates = pipe(
  stockSymbols,
  mergeMap(symbol => 
    // Subscribe to real-time price updates for each symbol
    new ReadableStream({
      start(controller) {
        const ws = new WebSocket(`wss://api.stocks.com/${symbol}`);
        
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          controller.enqueue({ symbol, price: data.price, timestamp: Date.now() });
        };
        
        ws.onerror = () => controller.error(new Error(`Connection failed for ${symbol}`));
        ws.onclose = () => controller.close();
      }
    })
  )
);

// Receives price updates from all symbols concurrently
```

### Error Handling with Concurrent Operations

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    mergeMap(n => {
      if (n === 3) {
        return throwError(new Error('Error at 3'));
      }
      return from([n * 10]);
    }),
    catchError(err => from(['error-handled']))
  )
);
// Concurrent operations, but error stops entire stream
// Result: [10, 20, 40, 'error-handled'] (order may vary)
```

## Key Characteristics

- **Concurrent execution**: Multiple inner streams can emit simultaneously
- **Order not preserved**: Output order depends on completion timing, not input order
- **Concurrency control**: Optional limit on simultaneous operations
- **Immediate start**: Inner streams start as soon as source emits (subject to concurrency limit)
- **Cancellation support**: AbortSignal allows proper cleanup of ongoing operations

## Performance Considerations

- **Memory usage**: Higher concurrency can increase memory usage
- **Resource limits**: Consider system limits (network connections, database connections)
- **Error propagation**: One error cancels all operations
- **Backpressure**: Respects downstream backpressure

## Common Use Cases

- **Parallel API calls**: When order doesn't matter
- **File processing**: Processing multiple files simultaneously
- **Real-time data**: Merging multiple data streams
- **Bulk operations**: Database operations that can run in parallel
- **Resource fetching**: Loading multiple resources concurrently

## See Also

- [`concatMap`](./concatMap.md) - Process sequentially, preserving order
- [`switchMap`](./switchMap.md) - Switch to latest, cancelling previous
- [`exhaustMap`](./exhaustMap.md) - Ignore new while processing current
- [`mergeAll`](./mergeAll.md) - Flatten stream of streams concurrently