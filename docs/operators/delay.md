# delay

Delays the emission of each value from the source stream by a specified duration. All values are delayed by the same amount of time, maintaining their relative timing.

## Type Signature

```typescript
function delay<T>(duration: number): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T>
```

## Parameters

- `duration`: The delay time in milliseconds. Must be non-negative.

## Examples

### Basic Delay

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3]),
    delay(1000) // Delay each value by 1 second
  )
);
// Original: 1---2---3---|
// Delayed:  ----1---2---3---|  (each delayed by 1000ms)
// Result: [1, 2, 3] (but each appears 1 second later)
```

### No Delay (Zero Duration)

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3]),
    delay(0) // No delay
  )
);
// Result: [1, 2, 3] (immediate, same as original timing)
```

### Animation Timing

```typescript
const animationFrames = from([
  { x: 0, y: 0 },
  { x: 10, y: 5 },
  { x: 20, y: 10 },
  { x: 30, y: 15 }
]);

const delayedAnimation = pipe(
  animationFrames,
  delay(16) // ~60fps delay between frames
);

// Each frame appears 16ms after it would have originally
for await (const frame of delayedAnimation) {
  console.log('Animate to:', frame);
  // Animation appears smoother with controlled timing
}
```

### Rate Limiting API Calls

```typescript
const apiRequests = from([
  '/api/users',
  '/api/posts', 
  '/api/comments',
  '/api/settings'
]);

const rateLimitedRequests = pipe(
  apiRequests,
  delay(200), // 200ms delay between requests
  map(async url => {
    const response = await fetch(url);
    return response.json();
  })
);

// Requests are spaced 200ms apart to avoid rate limiting
```

### Debounce-like Behavior

```typescript
const userInput = from(['h', 'e', 'l', 'l', 'o']);

const delayedInput = pipe(
  userInput,
  delay(300) // Delay each keypress by 300ms
);

// Useful for creating a delay before processing user input
const result = await toArray(delayedInput);
// Each character appears 300ms later than originally typed
```

### Simulating Network Latency

```typescript
const mockResponses = from([
  { data: 'response1', timestamp: Date.now() },
  { data: 'response2', timestamp: Date.now() },
  { data: 'response3', timestamp: Date.now() }
]);

const networkSimulation = pipe(
  mockResponses,
  delay(150) // Simulate 150ms network latency
);

// Each response arrives 150ms later, simulating real network conditions
```

### Staggered UI Updates

```typescript
const notifications = from([
  { id: 1, message: 'Welcome!' },
  { id: 2, message: 'New message received' },
  { id: 3, message: 'Update available' }
]);

const staggeredNotifications = pipe(
  notifications,
  delay(500) // 500ms delay between notifications
);

for await (const notification of staggeredNotifications) {
  showNotification(notification);
  // Notifications appear with nice spacing
}
```

### Loading State Management

```typescript
const loadingSteps = from([
  { step: 'Initializing...', progress: 0 },
  { step: 'Loading data...', progress: 33 },
  { step: 'Processing...', progress: 66 },
  { step: 'Complete!', progress: 100 }
]);

const smoothLoading = pipe(
  loadingSteps,
  delay(800) // 800ms between loading steps
);

// Creates a smooth loading experience with predictable timing
```

### Delayed Error Recovery

```typescript
const retryAttempts = from([
  { attempt: 1, action: 'connect' },
  { attempt: 2, action: 'connect' },
  { attempt: 3, action: 'connect' }
]);

const delayedRetries = pipe(
  retryAttempts,
  delay(2000) // 2 second delay between retry attempts
);

// Gives time for transient issues to resolve before retrying
```

### Game Event Timing

```typescript
const gameEvents = from([
  { type: 'spawn', entity: 'enemy1' },
  { type: 'spawn', entity: 'enemy2' },
  { type: 'powerup', item: 'shield' },
  { type: 'spawn', entity: 'boss' }
]);

const timedEvents = pipe(
  gameEvents,
  delay(2000) // 2 second delay between game events
);

// Controls game pacing by spacing out events
```

### Delayed Logging

```typescript
const logMessages = from([
  { level: 'info', message: 'System started' },
  { level: 'warn', message: 'Low memory' },
  { level: 'error', message: 'Connection failed' }
]);

const batchedLogs = pipe(
  logMessages,
  delay(1000) // 1 second delay for log batching
);

// Allows time for log aggregation or processing
```

### Audio/Video Synchronization

```typescript
const audioEvents = from([
  { track: 'intro.mp3', duration: 3000 },
  { track: 'main.mp3', duration: 120000 },
  { track: 'outro.mp3', duration: 5000 }
]);

const synchronizedAudio = pipe(
  audioEvents,
  delay(100) // Small delay for audio buffer
);

// Ensures audio has time to buffer before playback
```

### Progressive Image Loading

```typescript
const imageUrls = from([
  '/images/thumbnail1.jpg',
  '/images/thumbnail2.jpg', 
  '/images/thumbnail3.jpg',
  '/images/thumbnail4.jpg'
]);

const progressiveLoading = pipe(
  imageUrls,
  delay(250), // 250ms delay between image loads
  map(async url => {
    const img = new Image();
    img.src = url;
    return new Promise(resolve => {
      img.onload = () => resolve({ url, loaded: true });
    });
  })
);

// Images load progressively without overwhelming the browser
```

### Delayed Form Validation

```typescript
const formChanges = from([
  { field: 'email', value: 'user@' },
  { field: 'email', value: 'user@example' },
  { field: 'email', value: 'user@example.com' },
  { field: 'password', value: 'weak' },
  { field: 'password', value: 'strongPassword123!' }
]);

const delayedValidation = pipe(
  formChanges,
  delay(500) // 500ms delay before validation
);

// Prevents validation from running on every keystroke
```

### Sensor Data Smoothing

```typescript
const sensorReadings = interval(50).pipe( // Fast sensor readings every 50ms
  map(() => ({
    temperature: 20 + Math.random() * 10,
    humidity: 40 + Math.random() * 20,
    timestamp: Date.now()
  })),
  take(10)
);

const smoothedReadings = pipe(
  sensorReadings,
  delay(200) // Smooth out readings by adding delay
);

// Reduces noise by spacing out sensor readings
```

### Error Handling with Delay

```typescript
const operations = from([1, 2, 3, 4, 5]);

const result = await toArray(
  pipe(
    operations,
    delay(100),
    map(x => {
      if (x === 3) throw new Error('Processing error');
      return x * 2;
    }),
    catchError(err => from(['error-occurred']))
  )
);
// Each operation is delayed, including error propagation
```

### Combining with Other Timing Operators

```typescript
const fastEvents = interval(50).pipe(take(10)); // Events every 50ms

const controlledFlow = pipe(
  fastEvents,
  delay(100),      // Add 100ms delay
  throttleTime(200) // Then throttle to max one per 200ms
);

// Creates a controlled flow with both delay and throttling
```

### Testing Timing Behavior

```typescript
// Useful for testing time-dependent code
const testEvents = from(['start', 'middle', 'end']);

const delayedTest = pipe(
  testEvents,
  delay(100) // Predictable delay for testing
);

// Each event occurs exactly 100ms after the previous
```

### Memory Considerations

```typescript
// delay() stores values temporarily while waiting for delay
const largeData = from([
  new Array(1000000).fill('large-data'),
  new Array(1000000).fill('more-data')
]);

const delayedLargeData = pipe(
  largeData,
  delay(1000) // Large objects held in memory during delay
);

// Consider using references for large objects
const optimized = pipe(
  largeData,
  map((data, index) => ({ id: index, size: data.length })), // Extract metadata
  delay(1000)
);
```

### Chaining Multiple Delays

```typescript
const events = from([1, 2, 3]);

const multipleDelays = pipe(
  events,
  delay(100),  // First delay: 100ms
  delay(200)   // Second delay: additional 200ms
);

// Total delay per event: 300ms (100 + 200)
// Each value is delayed by cumulative time
```

## Key Characteristics

- **Uniform delay**: All values delayed by the same duration
- **Order preservation**: Relative timing between values is maintained
- **Non-blocking**: Doesn't block other operations while delaying
- **Memory usage**: Temporarily holds values during delay period
- **Error propagation**: Errors are also delayed by the specified duration

## Common Use Cases

- **Rate limiting**: Control the rate of operations or API calls
- **Animation timing**: Add smooth timing to UI animations
- **Debouncing**: Add delay before processing rapid inputs
- **Network simulation**: Simulate network latency or slow connections
- **User experience**: Stagger UI updates for better perceived performance
- **Audio/video sync**: Add buffering time for media synchronization
- **Testing**: Create predictable timing for time-dependent tests

## See Also

- [`debounceTime`](./debounceTime.md) - Delay and cancel rapid emissions
- [`throttleTime`](./throttleTime.md) - Limit emission rate
- [`timeout`](./timeout.md) - Error if no emission within duration
- [`timer`](../creation.md#timer) - Create delayed/interval streams