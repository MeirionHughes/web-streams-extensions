# switchMap

Maps each source value to a stream and flattens them, but only the most recent inner stream emits values. When a new source value arrives, the previous inner stream is cancelled and a new one is created from the projection function.

## Type Signature

```typescript
function switchMap<T, R>(
  project: (value: T, index: number, signal?: AbortSignal) => ReadableStream<R> | Promise<ReadableStream<R>>
): (src: ReadableStream<T>, strategy?: QueuingStrategy<R>) => ReadableStream<R>
```

## Parameters

- `project`: Function that maps each source value to a stream. Receives:
  - `value`: The current value from the source
  - `index`: The index of the current value
  - `signal`: An `AbortSignal` that will be aborted when this projection is cancelled

## Examples

### Basic Switching Behavior

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3]),
    switchMap(n => from([n * 10, n * 20, n * 30]))
  )
);
// Input:   1---2---3---|
// Inner 1: 10--20--30---|  (cancelled)
// Inner 2:     20--40--| (cancelled)  
// Inner 3:         30--60--90--|
// Output:  10--20--30--60--90--|
// Result: [10, 20, 30, 60, 90]
```

### Search with HTTP Request Cancellation

```typescript
const searchResults = pipe(
  userSearchInput, // from(['a', 'ab', 'abc'])
  debounceTime(300),
  switchMap((term, index, signal) =>
    fetch(`/api/search?q=${term}`, { signal }) // Pass signal for cancellation
      .then(response => response.json())
      .then(data => from(data.results))
  )
);

// Previous HTTP requests are automatically cancelled
// Only the final search request completes
```

### Custom Cancellable Operations

```typescript
const result = await toArray(
  pipe(
    from(['task1', 'task2', 'task3']),
    switchMap((task, index, signal) => {
      return new ReadableStream({
        start(controller) {
          // Set up a long-running operation
          const timeoutId = setTimeout(() => {
            if (!signal?.aborted) {
              controller.enqueue(`${task} completed`);
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
  )
);
// Only 'task3' completes, previous tasks are cancelled
// Result: ['task3 completed']
```

### User Input Processing

```typescript
const processedInput = pipe(
  from(['h', 'he', 'hel', 'hello']),
  switchMap(input => 
    // Simulate processing each input (e.g., autocomplete lookup)
    timer(100).pipe( // Simulate 100ms processing time
      map(() => `Processed: ${input}`)
    )
  )
);
// Input:  h---he---hel---hello---|
// Output: ---------------------Processed: hello|
// Result: ['Processed: hello'] (others cancelled)
```

### File Upload with Progress

```typescript
const uploadProgress = pipe(
  userFileSelections, // Stream of selected files
  switchMap((file, index, signal) => {
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
            controller.enqueue(`${file.name}: Upload complete`);
            controller.close();
          }
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
// When user selects a new file, previous upload is cancelled
```

### Async Stream Creation

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3]),
    switchMap(async (n) => {
      // Async stream creation (e.g., loading data)
      const data = await fetch(`/api/data/${n}`).then(r => r.json());
      return from(data.items);
    })
  )
);
// Each new source value cancels the previous async operation
```

## Key Characteristics

- **Cancellation**: Previous inner streams are cancelled when new values arrive
- **Latest wins**: Only the most recent inner stream's values are emitted
- **Resource cleanup**: Proper cleanup via AbortSignal prevents resource leaks
- **Async support**: Supports both sync and async stream creation

## Common Use Cases

- **Search**: Auto-complete, search-as-you-type with request cancellation
- **User input**: Processing form inputs where only the latest matters
- **File operations**: File uploads where new selections cancel previous ones
- **API calls**: Data fetching where only the latest request is relevant
- **Real-time updates**: Live data where fresher data supersedes older

## See Also

- [`concatMap`](./concatMap.md) - Process streams sequentially without cancellation
- [`mergeMap`](./mergeMap.md) - Process streams concurrently
- [`exhaustMap`](./exhaustMap.md) - Ignore new values while processing
- [`debounceTime`](./debounceTime.md) - Wait for quiet periods before emitting