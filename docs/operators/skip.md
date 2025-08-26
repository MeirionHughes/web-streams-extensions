# skip

Skips the first N values from the source stream, then emits all subsequent values. This is useful for ignoring initial values or implementing pagination-like behavior.

## Type Signature

```typescript
function skip<T>(count: number): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T>
```

## Parameters

- `count`: Number of values to skip from the beginning of the stream. Must be a non-negative integer.

## Examples

### Basic Skip

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4, 5]),
    skip(2)
  )
);
// Input:  1---2---3---4---5---|
// Output:         3---4---5---|
// Result: [3, 4, 5]
```

### Skip Zero (No-op)

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3]),
    skip(0)
  )
);
// Input:  1---2---3---|
// Output: 1---2---3---|
// Result: [1, 2, 3] (no values skipped)
```

### Skip More Than Available

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3]),
    skip(5) // Skip more than stream contains
  )
);
// Input:  1---2---3---|
// Output:             |
// Result: [] (all values skipped)
```

### Pagination Simulation

```typescript
const pageSize = 3;
const pageNumber = 2; // Second page (0-indexed)

const result = await toArray(
  pipe(
    range(1, 10), // [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    skip(pageNumber * pageSize), // Skip 6 items
    take(pageSize) // Take next 3 items
  )
);
// Result: [7, 8, 9] (page 2 of data)
```

### Skip Initial Setup Data

```typescript
const sensorData = interval(100).pipe(
  map(i => ({ 
    reading: Math.random() * 100, 
    calibrated: i >= 5 // First 5 readings are calibration
  }))
);

const calibratedReadings = pipe(
  sensorData,
  skip(5), // Skip calibration period
  take(10)
);

const result = await toArray(calibratedReadings);
// Skips first 5 calibration readings, takes next 10 actual readings
```

### Skip Headers in File Processing

```typescript
const csvLines = from([
  'Name,Age,City',        // Header line
  'John,25,New York',     // Data starts here
  'Jane,30,San Francisco',
  'Bob,35,Chicago'
]);

const dataRows = pipe(
  csvLines,
  skip(1) // Skip header row
);

const result = await toArray(dataRows);
// Result: ['John,25,New York', 'Jane,30,San Francisco', 'Bob,35,Chicago']
```

### Skip Initial Loading State

```typescript
const appStates = from([
  { status: 'loading', data: null },
  { status: 'loading', data: null },
  { status: 'loading', data: null },
  { status: 'ready', data: [1, 2, 3] },
  { status: 'ready', data: [4, 5, 6] }
]);

const readyStates = pipe(
  appStates,
  skip(3) // Skip loading states
);

const result = await toArray(readyStates);
// Result: [{ status: 'ready', data: [1, 2, 3] }, { status: 'ready', data: [4, 5, 6] }]
```

### Skip Warm-up Period

```typescript
const performanceMetrics = interval(1000).pipe(
  map(i => ({
    timestamp: Date.now(),
    responseTime: Math.random() * 200 + (i < 10 ? 500 : 100), // Slower during warm-up
    throughput: Math.random() * 1000 + (i < 10 ? 100 : 800)
  }))
);

const stableMetrics = pipe(
  performanceMetrics,
  skip(10), // Skip 10-second warm-up period
  take(30)
);

// Collects metrics after system has warmed up
```

### Stream Chunking with Skip

```typescript
const numbers = range(1, 20); // [1, 2, 3, ..., 20]

// Process in chunks, skipping processed items
async function processInChunks(stream: ReadableStream<number>, chunkSize: number) {
  const results = [];
  let processed = 0;
  
  while (processed < 20) {
    const chunk = await toArray(
      pipe(
        stream,
        skip(processed),
        take(chunkSize)
      )
    );
    
    if (chunk.length === 0) break;
    
    results.push(chunk);
    processed += chunkSize;
  }
  
  return results;
}

// Result: [[1,2,3,4,5], [6,7,8,9,10], [11,12,13,14,15], [16,17,18,19,20]]
```

### Skip Authentication Tokens

```typescript
const httpResponses = from([
  { type: 'auth', token: 'abc123' },
  { type: 'auth', token: 'def456' },
  { type: 'data', payload: { id: 1, name: 'Item 1' } },
  { type: 'data', payload: { id: 2, name: 'Item 2' } }
]);

const dataOnly = pipe(
  httpResponses,
  skip(2) // Skip authentication responses
);

const result = await toArray(dataOnly);
// Result: [{ type: 'data', payload: { id: 1, name: 'Item 1' } }, ...]
```

### Skip Buffer Fill Period

```typescript
const bufferStates = from([
  { buffered: 10, ready: false },
  { buffered: 25, ready: false },
  { buffered: 50, ready: false },
  { buffered: 75, ready: false },
  { buffered: 100, ready: true },  // Buffer full, ready to process
  { buffered: 95, ready: true },
  { buffered: 90, ready: true }
]);

const processingStates = pipe(
  bufferStates,
  skip(4) // Skip until buffer is ready
);

const result = await toArray(processingStates);
// Result: States where buffer is ready for processing
```

### Skip to Start Position

```typescript
function skipToPosition<T>(stream: ReadableStream<T>, startPosition: number) {
  return pipe(
    stream,
    skip(startPosition)
  );
}

const videoFrames = range(0, 1000); // Simulate 1000 video frames

// Start playback from frame 300
const playbackFrames = skipToPosition(videoFrames, 300);

const result = await toArray(pipe(playbackFrames, take(10)));
// Result: [300, 301, 302, 303, 304, 305, 306, 307, 308, 309]
```

### Game State Skip

```typescript
const gameStates = from([
  { level: 'loading' },
  { level: 'menu' },
  { level: 'intro' },
  { level: 'tutorial' },
  { level: 'level1' }, // Actual gameplay starts here
  { level: 'level2' },
  { level: 'level3' }
]);

const gameplay = pipe(
  gameStates,
  skip(4) // Skip loading, menu, intro, tutorial
);

const result = await toArray(gameplay);
// Result: [{ level: 'level1' }, { level: 'level2' }, { level: 'level3' }]
```

### Error Handling

```typescript
const numbers = from([1, 2, 3, 4, 5]);

// Skip operates normally even if count is larger than stream
const result = await toArray(
  pipe(
    numbers,
    skip(10) // Skip more than available
  )
);
// Result: [] (empty array, no error)

// Negative skip counts are treated as 0
const resultNegative = await toArray(
  pipe(
    numbers,
    skip(-5) // Negative count
  )
);
// Result: [1, 2, 3, 4, 5] (same as skip(0))
```

## Key Characteristics

- **Stateful operation**: Maintains a counter of skipped items
- **Early termination**: Once skip count is reached, all subsequent values pass through
- **Memory efficient**: Only tracks the skip counter, not the skipped values
- **Boundary handling**: Gracefully handles counts larger than stream length
- **Completion preservation**: Stream completion is preserved regardless of skip count

## Common Use Cases

- **Pagination**: Skip to specific page of results
- **Header removal**: Skip header rows in CSV/data processing
- **Warm-up periods**: Skip initial unstable measurements or states
- **Offset operations**: Start processing from a specific position
- **Chunked processing**: Process data in segments by skipping processed portions
- **State initialization**: Skip setup or loading states

## See Also

- [`skipWhile`](./skipWhile.md) - Skip while a condition is true
- [`take`](./take.md) - Take first N values
- [`slice`](../utils.md#slice) - Skip and take in one operation
- [`drop`](../utils.md#drop) - Alias for skip in some contexts