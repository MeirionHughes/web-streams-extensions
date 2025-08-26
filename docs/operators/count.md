# count

Counts the number of values emitted by the source stream and emits the total count when the source completes. Optionally counts only values that match a predicate function.

## Type Signature

```typescript
function count<T>(
  predicate?: (value: T, index: number) => boolean
): (src: ReadableStream<T>, strategy?: QueuingStrategy<number>) => ReadableStream<number>
```

## Parameters

- `predicate` *(optional)*: Function to determine which values to count. If omitted, all values are counted. Receives the value and its index.

## Examples

### Count All Values

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4, 5]),
    count()
  )
);
// Input:  1---2---3---4---5---|
// Output:                     5---|
// Result: [5]
```

### Count with Predicate

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4, 5, 6]),
    count(x => x % 2 === 0) // Count even numbers
  )
);
// Input:  1---2---3---4---5---6---|
// Test:   F---T---F---T---F---T (predicate results)
// Output:                        3---|
// Result: [3] (even numbers: 2, 4, 6)
```

### Count User Events

```typescript
const userEvents = from([
  { type: 'click', target: 'button1' },
  { type: 'scroll', position: 100 },
  { type: 'click', target: 'button2' },
  { type: 'hover', target: 'menu' },
  { type: 'click', target: 'link1' }
]);

const clickCount = await toArray(
  pipe(
    userEvents,
    count(event => event.type === 'click')
  )
);
// Result: [3] (three click events)
```

### Count Valid Entries

```typescript
const dataEntries = from([
  { name: 'Alice', age: 25, valid: true },
  { name: '', age: 30, valid: false },
  { name: 'Bob', age: -5, valid: false },
  { name: 'Charlie', age: 35, valid: true }
]);

const validEntryCount = await toArray(
  pipe(
    dataEntries,
    count(entry => entry.valid)
  )
);
// Result: [2] (Alice and Charlie are valid)
```

### Count High Scores

```typescript
const gameScores = from([45, 92, 67, 89, 34, 95, 78]);

const highScoreCount = await toArray(
  pipe(
    gameScores,
    count(score => score > 80)
  )
);
// Result: [3] (scores 92, 89, 95 are above 80)
```

### Count Errors in Log Stream

```typescript
const logEntries = from([
  { level: 'info', message: 'System started' },
  { level: 'warn', message: 'Low memory' },
  { level: 'error', message: 'Connection failed' },
  { level: 'info', message: 'Retry successful' },
  { level: 'error', message: 'Database timeout' }
]);

const errorCount = await toArray(
  pipe(
    logEntries,
    count(entry => entry.level === 'error')
  )
);
// Result: [2] (two error-level log entries)
```

### Count Successful API Responses

```typescript
const apiResponses = from([
  { status: 200, success: true },
  { status: 404, success: false },
  { status: 200, success: true },
  { status: 500, success: false },
  { status: 201, success: true }
]);

const successCount = await toArray(
  pipe(
    apiResponses,
    count(response => response.success)
  )
);
// Result: [3] (three successful responses)
```

### Count with Index-based Condition

```typescript
const items = from(['a', 'b', 'c', 'd', 'e', 'f']);

const evenPositionCount = await toArray(
  pipe(
    items,
    count((value, index) => index % 2 === 0)
  )
);
// Counts items at even positions (0, 2, 4)
// Result: [3] (items 'a', 'c', 'e')
```

### Count File Types

```typescript
const files = from([
  'document.pdf',
  'image.jpg', 
  'script.js',
  'photo.png',
  'data.json',
  'picture.gif'
]);

const imageCount = await toArray(
  pipe(
    files,
    count(filename => /\.(jpg|png|gif)$/i.test(filename))
  )
);
// Result: [3] (image.jpg, photo.png, picture.gif)
```

### Count Temperature Readings Above Threshold

```typescript
const temperatures = from([18.5, 22.1, 25.7, 19.3, 26.8, 24.2, 20.9]);

const hotDaysCount = await toArray(
  pipe(
    temperatures,
    count(temp => temp > 25)
  )
);
// Result: [2] (temperatures 25.7 and 26.8)
```

### Count Products in Price Range

```typescript
const products = from([
  { name: 'Phone', price: 999 },
  { name: 'Case', price: 25 },
  { name: 'Laptop', price: 1299 },
  { name: 'Mouse', price: 45 },
  { name: 'Keyboard', price: 89 }
]);

const affordableCount = await toArray(
  pipe(
    products,
    count(product => product.price <= 100)
  )
);
// Result: [3] (Case, Mouse, Keyboard are under $100)
```

### Count Active Users

```typescript
const users = from([
  { name: 'Alice', lastLogin: Date.now() - 86400000 }, // 1 day ago
  { name: 'Bob', lastLogin: Date.now() - 604800000 },  // 1 week ago
  { name: 'Charlie', lastLogin: Date.now() - 3600000 }, // 1 hour ago
  { name: 'Diana', lastLogin: Date.now() - 2592000000 } // 30 days ago
]);

const recentActiveCount = await toArray(
  pipe(
    users,
    count(user => (Date.now() - user.lastLogin) < 86400000 * 7) // Active in last week
  )
);
// Result: [2] (Alice and Charlie)
```

### Count Completed Tasks

```typescript
const tasks = from([
  { id: 1, status: 'completed', priority: 'high' },
  { id: 2, status: 'pending', priority: 'medium' },
  { id: 3, status: 'completed', priority: 'low' },
  { id: 4, status: 'in-progress', priority: 'high' },
  { id: 5, status: 'completed', priority: 'medium' }
]);

const completedCount = await toArray(
  pipe(
    tasks,
    count(task => task.status === 'completed')
  )
);
// Result: [3] (tasks 1, 3, and 5 are completed)
```

### Count Network Packets by Type

```typescript
const networkPackets = from([
  { type: 'TCP', size: 1024, urgent: false },
  { type: 'UDP', size: 512, urgent: false },
  { type: 'TCP', size: 2048, urgent: true },
  { type: 'ICMP', size: 64, urgent: false },
  { type: 'TCP', size: 1536, urgent: false }
]);

const tcpCount = await toArray(
  pipe(
    networkPackets,
    count(packet => packet.type === 'TCP')
  )
);
// Result: [3] (three TCP packets)
```

### Count Sensor Readings in Range

```typescript
const sensorData = interval(100).pipe(
  map(() => ({
    temperature: 15 + Math.random() * 20, // 15-35°C
    humidity: 30 + Math.random() * 40,    // 30-70%
    timestamp: Date.now()
  })),
  take(20)
);

const normalReadingsCount = await toArray(
  pipe(
    sensorData,
    count(reading => 
      reading.temperature >= 18 && reading.temperature <= 25 &&
      reading.humidity >= 40 && reading.humidity <= 60
    )
  )
);
// Counts readings within normal ranges
```

### Count Words in Text Stream

```typescript
const textLines = from([
  'Hello world, this is a test.',
  'Another line of text here.',
  'Final line with more words.'
]);

const wordCount = await toArray(
  pipe(
    textLines,
    map(line => line.split(/\s+/).length),
    reduce((total, lineWordCount) => total + lineWordCount, 0)
  )
);

// Alternative: count lines with more than 5 words
const longLinesCount = await toArray(
  pipe(
    textLines,
    count(line => line.split(/\s+/).length > 5)
  )
);
// Result: Number of lines with more than 5 words
```

### Count Database Query Results

```typescript
async function countMatchingRecords(criteria: any) {
  const queryStream = new ReadableStream({
    start(controller) {
      executeQuery('SELECT * FROM records WHERE ...', criteria)
        .then(rows => {
          rows.forEach(row => controller.enqueue(row));
          controller.close();
        })
        .catch(err => controller.error(err));
    }
  });

  return toArray(
    pipe(
      queryStream,
      count() // Count all matching records
    )
  );
}

// Returns [totalCount] where totalCount is number of matching records
```

### Count HTTP Status Codes

```typescript
const httpRequests = from([
  { url: '/api/users', status: 200 },
  { url: '/api/posts', status: 404 },
  { url: '/api/auth', status: 200 },
  { url: '/api/data', status: 500 },
  { url: '/api/settings', status: 200 }
]);

const successfulRequests = await toArray(
  pipe(
    httpRequests,
    count(req => req.status >= 200 && req.status < 300)
  )
);
// Result: [3] (three 2xx status codes)
```

### Count Game Events

```typescript
const gameEvents = from([
  { type: 'player_move', player: 'Alice' },
  { type: 'item_pickup', player: 'Bob' },
  { type: 'player_move', player: 'Alice' },
  { type: 'enemy_spawn', location: 'forest' },
  { type: 'player_attack', player: 'Alice' },
  { type: 'item_pickup', player: 'Alice' }
]);

const aliceActions = await toArray(
  pipe(
    gameEvents,
    count(event => 'player' in event && event.player === 'Alice')
  )
);
// Result: [4] (Alice performed 4 actions)
```

### Count Empty Streams

```typescript
const emptyResult = await toArray(
  pipe(
    empty(), // No values
    count()
  )
);
// Result: [0] (empty stream has 0 items)
```

### Count with Complex Conditions

```typescript
const orders = from([
  { id: 1, amount: 150, status: 'completed', urgent: false },
  { id: 2, amount: 75, status: 'pending', urgent: true },
  { id: 3, amount: 200, status: 'completed', urgent: false },
  { id: 4, amount: 50, status: 'cancelled', urgent: false },
  { id: 5, amount: 300, status: 'completed', urgent: true }
]);

const highValueCompletedCount = await toArray(
  pipe(
    orders,
    count(order => 
      order.status === 'completed' && 
      order.amount > 100 &&
      !order.urgent
    )
  )
);
// Result: [2] (orders 1 and 3 meet all criteria)
```

### Performance Monitoring

```typescript
const performanceMetrics = interval(1000).pipe(
  map(() => ({
    responseTime: Math.random() * 1000,
    cpuUsage: Math.random() * 100,
    memoryUsage: Math.random() * 100,
    timestamp: Date.now()
  })),
  take(60) // 1 minute of data
);

const slowResponseCount = await toArray(
  pipe(
    performanceMetrics,
    count(metric => metric.responseTime > 500)
  )
);
// Counts responses slower than 500ms in the monitoring period
```

### Testing and Validation

```typescript
function testStreamLength<T>(stream: ReadableStream<T>, expectedLength: number) {
  return pipe(
    stream,
    count(),
    map(actualLength => ({
      expected: expectedLength,
      actual: actualLength,
      passed: actualLength === expectedLength
    }))
  );
}

// Test that a transformation preserves count
const original = from([1, 2, 3, 4, 5]);
const transformed = pipe(original, map(x => x * 2));

const countTest = await toArray(testStreamLength(transformed, 5));
// Validates that transformation doesn't lose items
```

### Error Handling

```typescript
const dataWithErrors = from([1, 2, 3, 4, 5]);

const result = await toArray(
  pipe(
    dataWithErrors,
    map(x => {
      if (x === 3) throw new Error('Processing error');
      return x;
    }),
    count(), // Never reached due to error
    catchError(err => from([0])) // Fallback count
  )
);
// Error prevents count completion, fallback provides default
```

### Memory Efficiency

```typescript
// count() is memory efficient - doesn't store values, only counter
const largeStream = range(1, 1000000); // 1 million items

const largeCount = await toArray(
  pipe(
    largeStream,
    count(x => x % 1000 === 0) // Count multiples of 1000
  )
);
// Uses minimal memory regardless of stream size
// Result: [1000] (1000 multiples of 1000 in range 1-1,000,000)
```

## Key Characteristics

- **Deferred emission**: Only emits count when source stream completes
- **Memory efficient**: Only maintains a counter, not the actual values
- **Index-aware**: Predicate receives both value and index
- **Single emission**: Always emits exactly one count value
- **Completion required**: Source must complete for count to be emitted

## Common Use Cases

- **Analytics**: Count events, errors, or user actions
- **Data validation**: Count valid/invalid records
- **Performance monitoring**: Count slow responses or failures
- **Quality assurance**: Count test results or error conditions
- **Business metrics**: Count orders, users, or transactions
- **System monitoring**: Count log entries by type or severity
- **Stream validation**: Verify expected number of items
- **Resource usage**: Count files, connections, or requests

## See Also

- [`reduce`](./reduce.md) - Accumulate values with custom logic
- [`scan`](./scan.md) - Emit running totals
- [`filter`](./filter.md) - Filter before counting
- [`groupBy`](../utils.md#groupBy) - Count within groups