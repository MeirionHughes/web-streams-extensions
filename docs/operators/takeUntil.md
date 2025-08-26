# takeUntil

Takes values from the source stream until a notifier stream emits a value. When the notifier emits, the source stream is cancelled and the output stream completes immediately.

## Type Signature

```typescript
function takeUntil<T, U = any>(
  notifier: ReadableStream<U>
): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T>
```

## Parameters

- `notifier`: A stream that signals when to stop taking values from the source. When this stream emits any value, the operation stops.

## Examples

### Timer-based Cutoff

```typescript
const result = await toArray(
  pipe(
    interval(100), // Emits 0, 1, 2, 3... every 100ms
    takeUntil(timer(350)) // Stop after 350ms
  )
);
// Input:   0---1---2---3---4---5---...
// Timer:   -----------X (emits at 350ms)
// Output:  0---1---2---|
// Result: [0, 1, 2] (about 3-4 values before timer)
```

### User Action Cancellation

```typescript
const dataStream = interval(200); // Background data processing
const userClicksStop = timer(1000); // User clicks stop after 1 second

const result = await toArray(
  pipe(
    dataStream,
    takeUntil(userClicksStop)
  )
);
// Processes data until user action
// Result: [0, 1, 2, 3, 4] (values emitted before stop signal)
```

### HTTP Request with Timeout

```typescript
const httpRequest = new ReadableStream({
  start(controller) {
    fetch('/api/slow-endpoint')
      .then(response => response.json())
      .then(data => {
        controller.enqueue(data);
        controller.close();
      })
      .catch(err => controller.error(err));
  }
});

const timeout = timer(5000); // 5 second timeout

const result = await toArray(
  pipe(
    httpRequest,
    takeUntil(timeout)
  )
);
// Request is cancelled if it takes longer than 5 seconds
```

### Real-time Data Until Event

```typescript
const stockPrices = interval(100).pipe(
  map(() => ({ price: Math.random() * 100 + 50, timestamp: Date.now() }))
);

const marketClose = timer(2000); // Market closes after 2 seconds

const result = await toArray(
  pipe(
    stockPrices,
    takeUntil(marketClose)
  )
);
// Streams stock prices until market closes
// Result: Array of price objects collected before market close
```

### User Input Stream

```typescript
const userTyping = from(['h', 'e', 'l', 'l', 'o']);
const escapePressed = timer(300); // User presses escape

const result = await toArray(
  pipe(
    userTyping,
    takeUntil(escapePressed)
  )
);
// Input:  h---e---l---l---o---|
// Escape: -----------X
// Output: h---e---l---|
// Result: ['h', 'e', 'l'] (typing interrupted by escape)
```

### Sensor Monitoring

```typescript
const temperatureReadings = interval(1000).pipe(
  map(() => ({ temp: Math.random() * 40 + 10, time: Date.now() }))
);

const emergencyShutdown = new ReadableStream({
  start(controller) {
    // Simulate emergency condition after 5 seconds
    setTimeout(() => {
      controller.enqueue('EMERGENCY_STOP');
      controller.close();
    }, 5000);
  }
});

const safeReadings = pipe(
  temperatureReadings,
  takeUntil(emergencyShutdown)
);

// Monitors temperature until emergency shutdown signal
```

### Animation Until Complete

```typescript
const animationFrames = interval(16).pipe( // ~60fps
  map(frame => ({ frame, progress: frame / 60 }))
);

const animationComplete = timer(1000); // 1 second animation

const result = await toArray(
  pipe(
    animationFrames,
    takeUntil(animationComplete)
  )
);
// Produces animation frames until animation completes
// Result: Array of frame objects for 1 second
```

### WebSocket Until Disconnect

```typescript
const wsMessages = new ReadableStream({
  start(controller) {
    const ws = new WebSocket('wss://api.example.com/stream');
    
    ws.onmessage = (event) => {
      controller.enqueue(JSON.parse(event.data));
    };
    
    ws.onerror = (error) => {
      controller.error(error);
    };
  }
});

const userDisconnect = new ReadableStream({
  start(controller) {
    // User clicks disconnect button
    document.getElementById('disconnect').onclick = () => {
      controller.enqueue('disconnect');
      controller.close();
    };
  }
});

const messages = pipe(
  wsMessages,
  takeUntil(userDisconnect)
);

// Streams WebSocket messages until user disconnects
```

### Multiple Stop Conditions

```typescript
const dataSource = interval(100);

// Multiple conditions that can stop the stream
const stopConditions = race(
  timer(5000),        // Timeout after 5 seconds
  userCancellation,   // User cancels
  errorCondition      // Error occurs
);

const result = await toArray(
  pipe(
    dataSource,
    takeUntil(stopConditions)
  )
);
// Stops when ANY stop condition occurs
```

### Game Loop Until Game Over

```typescript
const gameLoop = interval(16).pipe( // Game ticks at ~60fps
  map(tick => ({ 
    tick, 
    playerHealth: Math.max(0, 100 - tick), 
    score: tick * 10 
  }))
);

const gameOver = gameLoop.pipe(
  filter(state => state.playerHealth <= 0),
  take(1) // Game over when health reaches 0
);

const gameStates = pipe(
  gameLoop,
  takeUntil(gameOver)
);

// Runs game loop until game over condition
```

### File Processing Until Complete

```typescript
const fileChunks = new ReadableStream({
  start(controller) {
    // Simulate reading file chunks
    let chunkIndex = 0;
    const interval = setInterval(() => {
      if (chunkIndex < 10) {
        controller.enqueue(`chunk-${chunkIndex++}`);
      } else {
        clearInterval(interval);
        controller.close();
      }
    }, 100);
  }
});

const processingComplete = timer(500); // Processing timeout

const result = await toArray(
  pipe(
    fileChunks,
    takeUntil(processingComplete)
  )
);
// Processes file chunks until timeout or completion
```

### Error Handling

```typescript
const dataStream = interval(100);
const errorTrigger = timer(300).pipe(
  map(() => { throw new Error('Stop condition error'); })
);

const result = await toArray(
  pipe(
    dataStream,
    takeUntil(errorTrigger),
    catchError(err => from(['stopped-due-to-error']))
  )
);
// If notifier errors, source continues until source completes
// Error in notifier doesn't stop the main stream
```

## Key Characteristics

- **Immediate termination**: Source stops as soon as notifier emits
- **Value independence**: What the notifier emits doesn't matter, only that it emits
- **Resource cleanup**: Both source and notifier are properly cancelled
- **Error isolation**: Notifier errors don't affect the source stream
- **Race condition**: First emission from notifier wins

## Common Use Cases

- **Timeout operations**: Stop processing after a time limit
- **User cancellation**: Allow users to interrupt long-running operations
- **Conditional stopping**: Stop based on external events or state changes
- **Resource management**: Clean up streams when certain conditions are met
- **Game mechanics**: Stop game loops on game over conditions
- **Real-time monitoring**: Stop monitoring when conditions change

## See Also

- [`take`](./take.md) - Take a specific number of values
- [`takeWhile`](./takeWhile.md) - Take while a condition is true
- [`timeout`](./timeout.md) - Error if no emission within duration
- [`race`](../creation.md#race) - First stream to emit wins