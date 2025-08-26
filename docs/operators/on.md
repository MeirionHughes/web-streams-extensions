# on

Attaches lifecycle callbacks to observe stream events without modifying the values. Provides hooks for start, complete, cancel, and error events.

## Type Signature

```typescript
type LifecycleCallbacks = {
  start?(): void;
  complete?(): void;
  cancel?(reason?: any): void;
  error?(err: any): void;
};

function on<T>(callbacks: LifecycleCallbacks): (
  src: ReadableStream<T>, 
  strategy?: QueuingStrategy<T>
) => ReadableStream<T>
```

## Parameters

- `callbacks`: Object containing optional lifecycle callback functions
  - `start?`: Called when stream begins reading
  - `complete?`: Called when stream completes naturally
  - `cancel?`: Called when consumer cancels the stream
  - `error?`: Called when stream encounters an error

## How It Works

The operator:
1. **Pass-through values**: All values flow through unchanged
2. **Lifecycle observation**: Calls appropriate callbacks at each lifecycle stage
3. **Side effects only**: Callbacks are for side effects, not value transformation
4. **Error handling**: Callbacks can handle errors but don't prevent propagation

## Examples

### Basic Lifecycle Monitoring

```typescript
const monitored = pipe(
  from([1, 2, 3, 4]),
  on({
    start: () => console.log('Stream started'),
    complete: () => console.log('Stream completed'),
    error: (err) => console.log('Stream error:', err)
  })
);

const result = await toArray(monitored);
// Console output:
// "Stream started"
// "Stream completed"
// Result: [1, 2, 3, 4]
```

### Resource Management

```typescript
let resource: DatabaseConnection;

const processedData = pipe(
  from(dataItems),
  on({
    start: () => {
      resource = openDatabase();
      console.log('Database connection opened');
    },
    complete: () => {
      resource.close();
      console.log('Database connection closed');
    },
    error: (err) => {
      resource?.close();
      console.log('Cleanup after error:', err.message);
    }
  }),
  map(item => processWithDatabase(resource, item))
);
```

### Cancellation Handling

```typescript
const cancellableStream = pipe(
  interval(100),
  on({
    start: () => console.log('Timer started'),
    cancel: (reason) => console.log('Timer cancelled:', reason),
    complete: () => console.log('Timer completed')
  }),
  take(5)
);

// Will trigger cancel callback when take(5) completes
const result = await toArray(cancellableStream);
// Console output:
// "Timer started"
// "Timer cancelled: undefined"
```

### Error Monitoring

```typescript
const errorProneStream = pipe(
  from([1, 2, 3, 4, 5]),
  map(x => {
    if (x === 3) throw new Error('Processing failed at 3');
    return x * 2;
  }),
  on({
    error: (err) => {
      console.error('Stream error detected:', err.message);
      logErrorToService(err);
    }
  })
);

try {
  await toArray(errorProneStream);
} catch (error) {
  // Error still propagates normally
}
```

### Performance Monitoring

```typescript
let startTime: number;
let valueCount = 0;

const performanceMonitored = pipe(
  from(largeDataSet),
  on({
    start: () => {
      startTime = performance.now();
      console.log('Processing started');
    },
    complete: () => {
      const duration = performance.now() - startTime;
      console.log(`Processed ${valueCount} items in ${duration}ms`);
    }
  }),
  tap(() => valueCount++),
  map(processItem)
);
```

### Multiple Callback Sets

```typescript
const multiMonitored = pipe(
  from([1, 2, 3]),
  on({
    start: () => console.log('First monitor: started'),
    complete: () => console.log('First monitor: completed')
  }),
  map(x => x * 2),
  on({
    start: () => console.log('Second monitor: started'),
    complete: () => console.log('Second monitor: completed')
  })
);

// Each operator gets its own lifecycle events
```

### Conditional Callbacks

```typescript
const DEBUG = true;

const debugStream = pipe(
  from(data),
  on({
    start: DEBUG ? () => console.log('Debug: stream started') : undefined,
    complete: DEBUG ? () => console.log('Debug: stream completed') : undefined,
    error: DEBUG ? (err) => console.log('Debug: error -', err) : undefined
  })
);
```

## Key Characteristics

- **Transparent**: Values pass through unchanged
- **Side effects**: Callbacks are for observation and side effects
- **Lifecycle hooks**: Provides access to all stream lifecycle events
- **Error safe**: Errors in callbacks don't break the stream
- **Resource management**: Perfect for setup/cleanup operations

## Use Cases

- **Resource management**: Open/close connections, files, etc.
- **Logging and monitoring**: Track stream lifecycle events
- **Performance measurement**: Time operations and count values
- **Cleanup operations**: Ensure resources are cleaned up
- **Debugging**: Add debugging information to streams
- **Analytics**: Track usage patterns and errors

## Comparison with Related Operators

- **`on`**: Lifecycle callbacks for stream events
- **`tap`**: Observe values as they pass through  
- **`catchError`**: Handle and recover from errors
- **`ignoreElements`**: Ignore values but preserve lifecycle

## See Also

- [`tap`](./tap.md) - Observe values without modification
- [`catchError`](./catchError.md) - Handle errors with fallback
- [`ignoreElements`](./ignoreElements.md) - Ignore values, preserve completion