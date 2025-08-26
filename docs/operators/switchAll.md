# switchAll

Flattens a stream of streams by switching to the latest inner stream, cancelling the previous one. Only the most recent inner stream is active at any time.

## Type Signature

```typescript
function switchAll<T>(): (
  src: ReadableStream<ReadableStream<T> | Promise<T> | Iterable<T> | AsyncIterable<T>>, 
  strategy?: QueuingStrategy<T>
) => ReadableStream<T>
```

## Parameters

- No parameters required
- `strategy`: Optional queuing strategy for backpressure control (default: `{ highWaterMark: 16 }`)

## How It Works

The operator:
1. **Switch to latest**: When a new inner stream arrives, cancels the current one
2. **Cancellation**: Previous inner streams are immediately cancelled
3. **Latest wins**: Only the most recent inner stream produces output values
4. **No buffering**: Values from cancelled streams are lost

## Examples

### Basic Switching Behavior

```typescript
const innerStreams = from([
  timer(0, 100).pipe(take(5), map(i => `A${i}`)),    // A0, A1, A2, A3, A4
  timer(250, 100).pipe(take(3), map(i => `B${i}`)),  // B0, B1, B2 (starts at 250ms)
  timer(400, 100).pipe(take(3), map(i => `C${i}`))   // C0, C1, C2 (starts at 400ms)
]);

const result = await toArray(
  pipe(
    innerStreams,
    switchAll()
  )
);
// Result: ['A0', 'A1', 'B0', 'C0', 'C1', 'C2']
// A stream cancelled when B starts, B cancelled when C starts
```

### Search Query Switching

```typescript
const searchQueries = from(['a', 'ab', 'abc', 'abcd']);

const searchResults = pipe(
  searchQueries,
  map(query => 
    from(searchAPI(query)).pipe(
      map(results => ({ query, results }))
    )
  ),
  switchAll()
);

// Only shows results for 'abcd' - previous searches are cancelled
```

### Auto-complete Example

```typescript
const userTyping = from([
  'j',
  'ja', 
  'jav',
  'java',
  'javascript'
]);

const suggestions = pipe(
  userTyping,
  map(input => 
    timer(300).pipe(  // Simulate API delay
      map(() => getSuggestions(input))
    )
  ),
  switchAll()
);

// Only the 'javascript' suggestions will be returned
// Earlier API calls are cancelled when user continues typing
```

### Real-time Data Switching

```typescript
const dataSources = from([
  'sensor1',
  'sensor2', 
  'sensor3'
]);

const activeDataStream = pipe(
  dataSources,
  map(sensorId => 
    interval(1000).pipe(
      map(reading => ({ sensorId, reading, timestamp: Date.now() }))
    )
  ),
  switchAll()
);

// Switches from sensor1 → sensor2 → sensor3
// Only sensor3 data continues to flow
```

### HTTP Request Switching

```typescript
const apiVersions = from([
  '/api/v1/data',
  '/api/v2/data',
  '/api/v3/data'
]);

const latestApiData = pipe(
  apiVersions,
  map(endpoint => 
    from(fetch(endpoint).then(r => r.json()))
  ),
  switchAll()
);

// Cancels v1 and v2 requests, only v3 response is used
```

### Navigation Route Switching

```typescript
const routeChanges = from([
  '/home',
  '/about',
  '/contact',
  '/products'
]);

const pageData = pipe(
  routeChanges,
  map(route => 
    from(loadPageData(route)).pipe(
      map(data => ({ route, data }))
    )
  ),
  switchAll()
);

// Only loads data for '/products' route
// Previous route data loading is cancelled
```

### WebSocket Stream Switching

```typescript
const connectionConfigs = from([
  { server: 'ws://primary.example.com', priority: 1 },
  { server: 'ws://secondary.example.com', priority: 2 },
  { server: 'ws://backup.example.com', priority: 3 }
]);

const activeConnection = pipe(
  connectionConfigs,
  map(config => 
    from(createWebSocketStream(config.server))
  ),
  switchAll()
);

// Switches connections: primary → secondary → backup
// Previous connections are closed/cancelled
```

## Key Characteristics

- **Latest wins**: Only the most recent inner stream produces values
- **Immediate cancellation**: Previous streams cancelled immediately
- **Memory efficient**: No buffering of cancelled stream values
- **Resource cleanup**: Automatically cancels unused streams
- **Race condition safe**: Handles rapid stream switching gracefully

## Use Cases

- **Search/autocomplete**: Cancel previous searches when user continues typing
- **API versioning**: Switch to latest API version, cancel old requests
- **Real-time data**: Switch between data sources (sensors, feeds, etc.)
- **Navigation**: Cancel previous page loads when route changes
- **Connection management**: Switch between different connection sources
- **User interactions**: Handle rapid user input changes

## Comparison with Related Operators

- **`switchAll`**: Cancels previous, switches to latest
- **`concatAll`**: Processes all streams sequentially, no cancellation
- **`mergeAll`**: Processes all streams concurrently
- **`exhaustAll`**: Ignores new streams while current is active

## See Also

- [`switchMap`](./switchMap.md) - Map and switch in one step
- [`concatAll`](./concatAll.md) - Flatten streams sequentially
- [`mergeAll`](./mergeAll.md) - Flatten streams concurrently
- [`exhaustAll`](./exhaustAll.md) - Exhaust current before next