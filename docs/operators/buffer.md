# buffer

Collects values from the source stream into arrays and emits them when the buffer reaches a specified size. The final buffer is emitted when the source stream completes, even if it's not full.

## Type Signature

```typescript
function buffer<T>(count: number): (src: ReadableStream<T>, strategy?: QueuingStrategy<T[]>) => ReadableStream<T[]>
```

## Parameters

- `count`: The number of elements to collect before emitting a buffer. Must be greater than 0.

## Examples

### Basic Buffering

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4, 5, 6]),
    buffer(2)
  )
);
// Input:  1---2---3---4---5---6---|
// Output: [1,2]---[3,4]---[5,6]---|
// Result: [[1, 2], [3, 4], [5, 6]]
```

### Incomplete Final Buffer

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4, 5]),
    buffer(3)
  )
);
// Input:  1---2---3---4---5---|
// Output: [1,2,3]---[4,5]---|
// Result: [[1, 2, 3], [4, 5]] (final buffer has only 2 elements)
```

### Single Element Buffers

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3]),
    buffer(1)
  )
);
// Input:  1---2---3---|
// Output: [1]---[2]---[3]---|
// Result: [[1], [2], [3]]
```

### Data Batching for API Calls

```typescript
const userIds = from([101, 102, 103, 104, 105, 106, 107, 108]);

const batchedRequests = pipe(
  userIds,
  buffer(3), // Process users in batches of 3
  map(async (batch) => {
    // Make batch API call
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: batch })
    });
    return response.json();
  })
);

const result = await toArray(batchedRequests);
// API called with: [101, 102, 103], [104, 105, 106], [107, 108]
```

### File Processing in Chunks

```typescript
const fileLines = from([
  'header1,header2,header3',
  'row1,data1,value1',
  'row2,data2,value2', 
  'row3,data3,value3',
  'row4,data4,value4',
  'row5,data5,value5'
]);

const processedChunks = pipe(
  fileLines,
  skip(1), // Skip header
  buffer(2), // Process 2 lines at a time
  map(lines => ({
    chunk: lines,
    processed: lines.map(line => line.split(','))
  }))
);

const result = await toArray(processedChunks);
// Result: Processed chunks of CSV data
```

### Event Batching

```typescript
const userEvents = from([
  { type: 'click', target: 'button1' },
  { type: 'scroll', target: 'window' },
  { type: 'click', target: 'button2' },
  { type: 'hover', target: 'menu' },
  { type: 'click', target: 'link1' }
]);

const eventBatches = pipe(
  userEvents,
  buffer(3) // Send analytics in batches of 3
);

for await (const batch of eventBatches) {
  console.log('Sending analytics batch:', batch);
  // Send to analytics service
}
// Batches: 3 events, then 2 events
```

### Sensor Data Aggregation

```typescript
const sensorReadings = interval(100).pipe(
  map(() => ({
    temperature: 20 + Math.random() * 10,
    humidity: 40 + Math.random() * 20,
    timestamp: Date.now()
  })),
  take(25)
);

const aggregatedData = pipe(
  sensorReadings,
  buffer(5), // Aggregate every 5 readings
  map(readings => ({
    avgTemperature: readings.reduce((sum, r) => sum + r.temperature, 0) / readings.length,
    avgHumidity: readings.reduce((sum, r) => sum + r.humidity, 0) / readings.length,
    sampleCount: readings.length,
    timeRange: {
      start: readings[0].timestamp,
      end: readings[readings.length - 1].timestamp
    }
  }))
);

// Groups sensor readings for statistical analysis
```

### Database Batch Inserts

```typescript
const records = from([
  { name: 'Alice', age: 25 },
  { name: 'Bob', age: 30 },
  { name: 'Charlie', age: 35 },
  { name: 'Diana', age: 28 },
  { name: 'Eve', age: 32 }
]);

const batchInserts = pipe(
  records,
  buffer(3), // Insert in batches of 3
  map(async (batch) => {
    // Perform batch database insert
    const query = `INSERT INTO users (name, age) VALUES ${
      batch.map(r => `('${r.name}', ${r.age})`).join(', ')
    }`;
    return executeQuery(query);
  })
);

// Efficient database operations with batched inserts
```

### Image Processing Pipeline

```typescript
const imageFiles = from([
  'image1.jpg', 'image2.jpg', 'image3.jpg', 
  'image4.jpg', 'image5.jpg', 'image6.jpg',
  'image7.jpg'
]);

const processedBatches = pipe(
  imageFiles,
  buffer(3), // Process images in batches
  map(async (batch) => {
    return Promise.all(
      batch.map(async (filename) => {
        const processed = await processImage(filename);
        return { original: filename, processed: processed.path };
      })
    );
  })
);

// Parallel image processing in controlled batches
```

### Message Queue Processing

```typescript
const messages = from([
  { id: 1, content: 'Message 1', priority: 'high' },
  { id: 2, content: 'Message 2', priority: 'low' },
  { id: 3, content: 'Message 3', priority: 'medium' },
  { id: 4, content: 'Message 4', priority: 'high' },
  { id: 5, content: 'Message 5', priority: 'low' }
]);

const messageQueues = pipe(
  messages,
  buffer(2), // Process messages in batches
  map(batch => ({
    batchId: crypto.randomUUID(),
    messages: batch,
    totalCount: batch.length,
    priorityDistribution: batch.reduce((acc, msg) => {
      acc[msg.priority] = (acc[msg.priority] || 0) + 1;
      return acc;
    }, {})
  }))
);

// Efficient message queue processing
```

### Network Packet Aggregation

```typescript
const networkPackets = interval(50).pipe(
  map(i => ({
    packetId: i,
    data: `packet-${i}`,
    size: Math.floor(Math.random() * 1024) + 256,
    timestamp: Date.now()
  })),
  take(20)
);

const packetGroups = pipe(
  networkPackets,
  buffer(4), // Group packets for efficient transmission
  map(packets => ({
    groupId: crypto.randomUUID(),
    packets: packets,
    totalSize: packets.reduce((sum, p) => sum + p.size, 0),
    startTime: packets[0].timestamp,
    endTime: packets[packets.length - 1].timestamp
  }))
);

// Network optimization through packet grouping
```

### Testing Data Generation

```typescript
const testCases = from([
  { input: 1, expected: 2 },
  { input: 2, expected: 4 },
  { input: 3, expected: 6 },
  { input: 4, expected: 8 },
  { input: 5, expected: 10 }
]);

const testSuites = pipe(
  testCases,
  buffer(2), // Run tests in small batches
  map((batch, batchIndex) => ({
    suiteId: `batch-${batchIndex}`,
    tests: batch,
    runTests: () => batch.map(test => ({
      ...test,
      result: test.input * 2,
      passed: (test.input * 2) === test.expected
    }))
  }))
);

// Organized test execution in batches
```

### Log Processing

```typescript
const logEntries = from([
  { level: 'info', message: 'System started', timestamp: Date.now() },
  { level: 'warn', message: 'Low memory', timestamp: Date.now() + 1000 },
  { level: 'error', message: 'Connection failed', timestamp: Date.now() + 2000 },
  { level: 'info', message: 'Retry successful', timestamp: Date.now() + 3000 },
  { level: 'debug', message: 'Cache cleared', timestamp: Date.now() + 4000 }
]);

const logBatches = pipe(
  logEntries,
  buffer(3), // Process logs in batches
  map(batch => ({
    batchTimestamp: Date.now(),
    logCount: batch.length,
    errorCount: batch.filter(log => log.level === 'error').length,
    warningCount: batch.filter(log => log.level === 'warn').length,
    logs: batch
  }))
);

// Efficient log aggregation and analysis
```

### Shopping Cart Grouping

```typescript
const cartItems = from([
  { product: 'Laptop', price: 999, category: 'Electronics' },
  { product: 'Mouse', price: 25, category: 'Electronics' },
  { product: 'Book', price: 15, category: 'Books' },
  { product: 'Keyboard', price: 75, category: 'Electronics' },
  { product: 'Magazine', price: 5, category: 'Books' }
]);

const itemGroups = pipe(
  cartItems,
  buffer(2), // Group items for shipping optimization
  map(group => ({
    groupId: crypto.randomUUID(),
    items: group,
    totalValue: group.reduce((sum, item) => sum + item.price, 0),
    categories: [...new Set(group.map(item => item.category))],
    shippingEstimate: calculateShipping(group)
  }))
);

// E-commerce order processing optimization
```

### Animation Frame Batching

```typescript
const animationData = interval(16).pipe( // ~60fps
  map(frame => ({
    frame,
    x: Math.sin(frame * 0.1) * 100,
    y: Math.cos(frame * 0.1) * 100,
    rotation: frame * 2
  })),
  take(30)
);

const animationBatches = pipe(
  animationData,
  buffer(5), // Process animation frames in batches
  map(frames => ({
    batchStart: frames[0].frame,
    batchEnd: frames[frames.length - 1].frame,
    keyframes: frames,
    duration: (frames.length - 1) * 16 // milliseconds
  }))
);

// Optimized animation processing
```

### Error Handling with Buffers

```typescript
const data = from([1, 2, 3, 4, 5, 6]);

const result = await toArray(
  pipe(
    data,
    map(x => {
      if (x === 4) throw new Error('Processing error');
      return x;
    }),
    buffer(2),
    catchError(err => from([['error-batch']]))
  )
);
// Error during buffering affects the entire operation
```

### Memory Considerations

```typescript
// For large datasets, consider buffer size carefully
const largeDataset = range(1, 1000000); // 1 million items

const efficientBuffering = pipe(
  largeDataset,
  buffer(1000), // Reasonable buffer size
  map(batch => ({
    batchSize: batch.length,
    sum: batch.reduce((a, b) => a + b, 0),
    avg: batch.reduce((a, b) => a + b, 0) / batch.length
  }))
);

// Process large datasets without memory overflow
```

### Dynamic Buffer Sizing

```typescript
function createDynamicBuffer<T>(
  source: ReadableStream<T>, 
  minSize: number, 
  maxSize: number
) {
  // Implementation would adjust buffer size based on conditions
  return pipe(
    source,
    buffer(Math.max(minSize, Math.min(maxSize, 10))) // Example logic
  );
}

// Adaptive buffering based on system conditions
```

### Combining with Other Operators

```typescript
const numbers = range(1, 20);

const processedBatches = pipe(
  numbers,
  filter(x => x % 2 === 0), // Only even numbers
  buffer(3),                // Buffer in groups of 3
  map(batch => batch.reduce((sum, x) => sum + x, 0)), // Sum each batch
  filter(sum => sum > 20)   // Only sums greater than 20
);

// Complex processing pipeline with buffering
```

## Key Characteristics

- **Fixed size**: Emits arrays of exactly `count` elements (except possibly the last)
- **Memory efficient**: Only stores current buffer in memory
- **Completion handling**: Final incomplete buffer is always emitted
- **Order preservation**: Maintains order of elements within and between buffers
- **Blocking behavior**: Waits for buffer to fill before emitting

## Common Use Cases

- **Batch processing**: Group items for efficient batch operations
- **API optimization**: Reduce request count by batching multiple items
- **Database operations**: Batch inserts, updates, or queries
- **Network optimization**: Group small messages for efficient transmission
- **Memory management**: Process large datasets in manageable chunks
- **Analytics**: Aggregate events or metrics in time windows
- **File processing**: Handle large files in smaller, manageable sections

## See Also

- [`startWith`](./startWith.md) - Prepend values to stream
- [`chunk`](../utils.md#chunk) - Alternative chunking strategies
- [`window`](../utils.md#window) - Time-based buffering
- [`groupBy`](../transformation.md#groupBy) - Group by key rather than count