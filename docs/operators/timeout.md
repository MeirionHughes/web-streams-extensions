# timeout

Emits an error if the duration waiting for a value from the source stream exceeds the specified timeout. This is useful for detecting stalled streams or enforcing maximum wait times.

## Type Signature

```typescript
function timeout<T>(duration: number): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T>
```

## Parameters

- `duration`: Timeout duration in milliseconds. Must be positive.

## Examples

### Basic Timeout

```typescript
const result = await toArray(
  pipe(
    timer(2000), // Emits after 2 seconds
    timeout(1000), // Timeout after 1 second
    catchError(err => from(['timeout-error']))
  )
);
// Input:  ----x (would emit at 2000ms)
// Timeout: --X (timeout at 1000ms)
// Result: ['timeout-error']
```

### Successful Operation Within Timeout

```typescript
const result = await toArray(
  pipe(
    timer(500), // Emits after 500ms
    timeout(1000) // Timeout after 1 second
  )
);
// Input:  --x| (emits at 500ms)
// Timeout: ----X (timeout would be at 1000ms)
// Result: [0] (successful, no timeout)
```

### HTTP Request Timeout

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

const result = await toArray(
  pipe(
    httpRequest,
    timeout(5000), // 5 second timeout
    catchError(err => from([{ error: 'Request timed out' }]))
  )
);
// Request succeeds or times out after 5 seconds
```

### Sensor Reading Timeout

```typescript
const sensorStream = new ReadableStream({
  start(controller) {
    // Simulate sensor that might stop responding
    let reading = 0;
    const interval = setInterval(() => {
      if (Math.random() > 0.7) { // 30% chance of reading
        controller.enqueue({ 
          value: reading++, 
          timestamp: Date.now() 
        });
      }
    }, 1000);
  }
});

const reliableSensor = pipe(
  sensorStream,
  timeout(3000), // Error if no reading within 3 seconds
  catchError(err => from([{ error: 'Sensor timeout', timestamp: Date.now() }]))
);

// Detects when sensor stops responding
```

### Database Query Timeout

```typescript
async function queryWithTimeout(query: string) {
  const dbStream = new ReadableStream({
    start(controller) {
      // Simulate database query
      simulateDBQuery(query)
        .then(results => {
          results.forEach(row => controller.enqueue(row));
          controller.close();
        })
        .catch(err => controller.error(err));
    }
  });

  return toArray(
    pipe(
      dbStream,
      timeout(10000), // 10 second query timeout
      catchError(err => from([{ error: 'Query timeout' }]))
    )
  );
}

// Prevents long-running queries from hanging
```

### WebSocket Message Timeout

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

const timedMessages = pipe(
  wsMessages,
  timeout(30000), // 30 second timeout between messages
  catchError(err => from([{ type: 'connection-timeout' }]))
);

// Detects when WebSocket connection becomes stale
```

### File Processing Timeout

```typescript
const fileProcessor = new ReadableStream({
  start(controller) {
    // Simulate file processing that might hang
    processLargeFile('/path/to/file.csv')
      .then(chunks => {
        chunks.forEach(chunk => {
          controller.enqueue(chunk);
          // Random delay between chunks
          setTimeout(() => {}, Math.random() * 2000);
        });
        controller.close();
      })
      .catch(err => controller.error(err));
  }
});

const result = await toArray(
  pipe(
    fileProcessor,
    timeout(5000), // 5 second timeout between chunks
    catchError(err => from([{ error: 'File processing stalled' }]))
  )
);
```

### API Health Check

```typescript
function healthCheck(endpoint: string) {
  const healthStream = new ReadableStream({
    start(controller) {
      fetch(endpoint + '/health')
        .then(response => {
          if (response.ok) {
            controller.enqueue({ status: 'healthy', timestamp: Date.now() });
          } else {
            controller.enqueue({ status: 'unhealthy', timestamp: Date.now() });
          }
          controller.close();
        })
        .catch(err => controller.error(err));
    }
  });

  return pipe(
    healthStream,
    timeout(2000), // 2 second health check timeout
    catchError(err => from([{ status: 'timeout', timestamp: Date.now() }]))
  );
}

// Quick health checks with automatic timeout
```

### User Input Timeout

```typescript
const userInputPrompt = new ReadableStream({
  start(controller) {
    const input = document.getElementById('user-input');
    const submitBtn = document.getElementById('submit');
    
    submitBtn.onclick = () => {
      controller.enqueue(input.value);
      controller.close();
    };
  }
});

const result = await toArray(
  pipe(
    userInputPrompt,
    timeout(30000), // 30 second timeout for user input
    catchError(err => from(['Input timeout - using default']))
  )
);
// Auto-proceed if user doesn't respond within 30 seconds
```

### Stream Processing Pipeline Timeout

```typescript
const dataSource = interval(100).pipe(
  map(i => ({ id: i, data: `item-${i}` })),
  take(10)
);

const processedData = pipe(
  dataSource,
  map(async item => {
    // Simulate processing that might hang
    await new Promise(resolve => 
      setTimeout(resolve, Math.random() * 3000)
    );
    return { ...item, processed: true };
  }),
  timeout(2000), // 2 second timeout per item
  catchError(err => from([{ error: 'Processing timeout' }]))
);

// Ensures processing doesn't hang on any single item
```

### Batch Operation Timeout

```typescript
const batchProcessor = new ReadableStream({
  start(controller) {
    processBatch([1, 2, 3, 4, 5])
      .then(results => {
        results.forEach(result => controller.enqueue(result));
        controller.close();
      })
      .catch(err => controller.error(err));
  }
});

const result = await toArray(
  pipe(
    batchProcessor,
    timeout(15000), // 15 second timeout for entire batch
    catchError(err => from([{ error: 'Batch processing timeout' }]))
  )
);
```

### Network Request with Retries

```typescript
async function fetchWithTimeout(url: string, timeoutMs: number = 5000) {
  const request = new ReadableStream({
    start(controller) {
      fetch(url)
        .then(response => response.json())
        .then(data => {
          controller.enqueue(data);
          controller.close();
        })
        .catch(err => controller.error(err));
    }
  });

  return toArray(
    pipe(
      request,
      timeout(timeoutMs),
      catchError(err => {
        if (err.message.includes('timeout')) {
          return from([{ error: 'Request timeout', url }]);
        }
        throw err;
      })
    )
  );
}

// HTTP requests with automatic timeout handling
```

### Animation Frame Timeout

```typescript
const animationFrames = new ReadableStream({
  start(controller) {
    function animate() {
      requestAnimationFrame(timestamp => {
        controller.enqueue({ timestamp, frame: performance.now() });
        animate(); // Continue animation
      });
    }
    animate();
  }
});

const timedAnimation = pipe(
  animationFrames,
  timeout(100), // Timeout if frame rate drops too low
  catchError(err => from([{ error: 'Animation stalled' }]))
);

// Detects when animation frame rate becomes too slow
```

### Background Task Monitoring

```typescript
const backgroundTask = new ReadableStream({
  start(controller) {
    // Simulate background task with progress updates
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      controller.enqueue({ progress, status: 'running' });
      
      if (progress >= 100) {
        controller.enqueue({ progress: 100, status: 'complete' });
        controller.close();
        clearInterval(interval);
      }
    }, 2000); // Progress every 2 seconds
  }
});

const monitoredTask = pipe(
  backgroundTask,
  timeout(25000), // 25 second timeout for task completion
  catchError(err => from([{ error: 'Task timeout', status: 'failed' }]))
);

// Monitors long-running tasks with timeout protection
```

### Multiple Timeout Stages

```typescript
const multiStageProcess = new ReadableStream({
  start(controller) {
    // Stage 1: Initialization
    setTimeout(() => {
      controller.enqueue({ stage: 1, status: 'initialized' });
      
      // Stage 2: Processing  
      setTimeout(() => {
        controller.enqueue({ stage: 2, status: 'processed' });
        
        // Stage 3: Finalization
        setTimeout(() => {
          controller.enqueue({ stage: 3, status: 'complete' });
          controller.close();
        }, 3000);
      }, 2000);
    }, 1000);
  }
});

const timedProcess = pipe(
  multiStageProcess,
  timeout(8000), // Total timeout for all stages
  catchError(err => from([{ error: 'Process timeout' }]))
);

// Ensures entire multi-stage process completes within time limit
```

### Testing Slow Operations

```typescript
// Useful for testing timeout behavior
function createSlowStream(delay: number) {
  return new ReadableStream({
    start(controller) {
      setTimeout(() => {
        controller.enqueue('slow-data');
        controller.close();
      }, delay);
    }
  });
}

// Test that timeout works correctly
const result = await toArray(
  pipe(
    createSlowStream(2000), // 2 second delay
    timeout(1000), // 1 second timeout
    catchError(err => from(['caught-timeout']))
  )
);
// Result: ['caught-timeout']
```

### Combining with Other Operators

```typescript
const dataStream = interval(500).pipe(take(10));

const processedWithTimeout = pipe(
  dataStream,
  map(x => x * 2),
  timeout(1000), // Timeout between any two emissions
  filter(x => x > 5),
  catchError(err => from([-1])) // Error indicator
);

// Complex processing with timeout protection at each stage
```

### Error Message Customization

```typescript
function createTimeoutStream<T>(
  source: ReadableStream<T>, 
  timeoutMs: number, 
  errorMessage?: string
) {
  return pipe(
    source,
    timeout(timeoutMs),
    catchError(err => {
      const message = errorMessage || `Operation timed out after ${timeoutMs}ms`;
      return from([{ error: message, timestamp: Date.now() }]);
    })
  );
}

// Custom timeout messages for better error handling
const result = await toArray(
  createTimeoutStream(
    slowOperation(), 
    5000, 
    'Database query took too long'
  )
);
```

## Key Characteristics

- **Per-value timeout**: Timeout applies to each individual value emission
- **Automatic error**: Throws an error when timeout is exceeded
- **Timer reset**: Timer resets after each successful value emission
- **Resource cleanup**: Properly cancels source stream on timeout
- **Immediate failure**: Fails fast when timeout condition is met

## Common Use Cases

- **HTTP request timeouts**: Prevent hanging network requests
- **Database query limits**: Avoid long-running database operations
- **Sensor monitoring**: Detect when sensors stop responding
- **User interaction timeouts**: Handle unresponsive user interfaces
- **Background task monitoring**: Ensure tasks complete within time limits
- **WebSocket connection health**: Detect stale connections
- **File processing limits**: Prevent file operations from hanging

## See Also

- [`delay`](./delay.md) - Add delay to emissions
- [`debounceTime`](./debounceTime.md) - Debounce rapid emissions
- [`takeUntil`](./takeUntil.md) - Stop stream based on another stream
- [`timer`](../creation.md#timer) - Create time-based streams