# catchError

Catches errors from the source stream and switches to a fallback stream provided by a selector function. This allows graceful error handling and recovery in stream processing pipelines.

## Type Signature

```typescript
function catchError<T>(
  selector: (error: any, caught: ReadableStream<T>) => ReadableStream<T>
): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T>
```

## Parameters

- `selector`: Function that receives the error and the original stream, and returns a fallback stream to continue with.

## Examples

### Basic Error Handling

```typescript
const errorStream = new ReadableStream({
  start(controller) {
    controller.enqueue(1);
    controller.enqueue(2);
    controller.error(new Error('Something went wrong'));
  }
});

const result = await toArray(
  pipe(
    errorStream,
    catchError(err => from(['fallback', 'values']))
  )
);
// Input:  1---2---X (error)
// Output: 1---2---'fallback'---'values'---|
// Result: [1, 2, 'fallback', 'values']
```

### HTTP Request with Fallback

```typescript
const httpRequest = new ReadableStream({
  start(controller) {
    fetch('/api/data')
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
    catchError(err => from([{ error: 'Network failed', cached: true, data: [] }]))
  )
);
// Falls back to cached data if network request fails
```

### Database Query with Retry

```typescript
function createDatabaseQuery(query: string) {
  return new ReadableStream({
    start(controller) {
      executeQuery(query)
        .then(results => {
          results.forEach(row => controller.enqueue(row));
          controller.close();
        })
        .catch(err => controller.error(err));
    }
  });
}

const result = await toArray(
  pipe(
    createDatabaseQuery('SELECT * FROM users'),
    catchError(err => {
      console.log('Primary query failed, trying backup:', err.message);
      return createDatabaseQuery('SELECT * FROM users_backup');
    })
  )
);
// Automatically switches to backup table on error
```

### File Processing with Alternative Source

```typescript
const primaryFile = new ReadableStream({
  start(controller) {
    fetch('/data/primary.json')
      .then(response => {
        if (!response.ok) throw new Error('File not found');
        return response.json();
      })
      .then(data => {
        data.forEach(item => controller.enqueue(item));
        controller.close();
      })
      .catch(err => controller.error(err));
  }
});

const result = await toArray(
  pipe(
    primaryFile,
    catchError(err => {
      console.log('Primary file failed, using fallback');
      return from([
        { id: 1, name: 'Default Item 1' },
        { id: 2, name: 'Default Item 2' }
      ]);
    })
  )
);
// Uses default data if primary file is unavailable
```

### API with Multiple Fallbacks

```typescript
function createApiStream(endpoint: string) {
  return new ReadableStream({
    start(controller) {
      fetch(endpoint)
        .then(response => response.json())
        .then(data => {
          controller.enqueue(data);
          controller.close();
        })
        .catch(err => controller.error(err));
    }
  });
}

const result = await toArray(
  pipe(
    createApiStream('/api/v2/data'),
    catchError(err => {
      console.log('API v2 failed, trying v1');
      return pipe(
        createApiStream('/api/v1/data'),
        catchError(err => {
          console.log('API v1 failed, using local cache');
          return from([{ source: 'cache', data: 'cached-data' }]);
        })
      );
    })
  )
);
// Cascading fallbacks: v2 -> v1 -> cache
```

### Sensor Reading with Backup

```typescript
const primarySensor = new ReadableStream({
  start(controller) {
    // Simulate sensor that might fail
    let reading = 0;
    const interval = setInterval(() => {
      if (reading === 3) {
        clearInterval(interval);
        controller.error(new Error('Sensor malfunction'));
        return;
      }
      controller.enqueue({ 
        sensor: 'primary', 
        value: 20 + Math.random() * 10,
        reading: reading++
      });
    }, 500);
  }
});

const backupSensor = interval(600).pipe(
  map(i => ({ 
    sensor: 'backup', 
    value: 18 + Math.random() * 12,
    reading: i
  })),
  take(5)
);

const result = await toArray(
  pipe(
    primarySensor,
    catchError(err => {
      console.log('Primary sensor failed, switching to backup');
      return backupSensor;
    })
  )
);
// Seamlessly switches to backup sensor on primary failure
```

### User Authentication Flow

```typescript
const primaryAuth = new ReadableStream({
  start(controller) {
    authenticateUser('primary-method')
      .then(user => {
        controller.enqueue({ user, method: 'primary' });
        controller.close();
      })
      .catch(err => controller.error(err));
  }
});

const result = await toArray(
  pipe(
    primaryAuth,
    catchError(err => {
      if (err.code === 'PRIMARY_DOWN') {
        return from([{ user: 'guest', method: 'fallback' }]);
      }
      return from([{ error: 'Authentication failed', method: 'none' }]);
    })
  )
);
// Provides guest access or error state based on failure type
```

### Data Processing with Error Recovery

```typescript
const dataProcessor = from([
  { id: 1, data: 'valid' },
  { id: 2, data: 'invalid' },
  { id: 3, data: 'valid' }
]);

const processedData = pipe(
  dataProcessor,
  map(item => {
    if (item.data === 'invalid') {
      throw new Error(`Invalid data for id ${item.id}`);
    }
    return { ...item, processed: true };
  }),
  catchError(err => {
    console.log('Processing error:', err.message);
    return from([{ id: -1, data: 'error-placeholder', processed: false }]);
  })
);

const result = await toArray(processedData);
// Replaces entire stream with error placeholder on any processing error
```

### WebSocket with Reconnection

```typescript
function createWebSocketStream(url: string) {
  return new ReadableStream({
    start(controller) {
      const ws = new WebSocket(url);
      
      ws.onmessage = (event) => {
        controller.enqueue(JSON.parse(event.data));
      };
      
      ws.onerror = (error) => {
        controller.error(new Error('WebSocket error'));
      };
      
      ws.onclose = () => {
        controller.close();
      };
    }
  });
}

const result = await toArray(
  pipe(
    createWebSocketStream('wss://api.example.com/live'),
    catchError(err => {
      console.log('WebSocket failed, using polling fallback');
      return interval(1000).pipe(
        map(() => ({ source: 'polling', data: 'fallback-data', timestamp: Date.now() })),
        take(10)
      );
    })
  )
);
// Falls back to polling if WebSocket connection fails
```

### Configuration Loading

```typescript
const remoteConfig = new ReadableStream({
  start(controller) {
    fetch('/config/remote.json')
      .then(response => response.json())
      .then(config => {
        controller.enqueue(config);
        controller.close();
      })
      .catch(err => controller.error(err));
  }
});

const defaultConfig = {
  theme: 'light',
  language: 'en',
  features: ['basic'],
  version: '1.0.0'
};

const result = await toArray(
  pipe(
    remoteConfig,
    catchError(err => {
      console.log('Remote config failed, using defaults');
      return from([defaultConfig]);
    })
  )
);
// Always provides a valid configuration
```

### Batch Operation Recovery

```typescript
const batchProcessor = from([
  { batch: 1, items: [1, 2, 3] },
  { batch: 2, items: [4, 5, 6] },
  { batch: 3, items: [7, 8, 9] }
]);

const processedBatches = pipe(
  batchProcessor,
  map(batch => {
    if (batch.batch === 2) {
      throw new Error('Batch 2 processing failed');
    }
    return { ...batch, processed: true, timestamp: Date.now() };
  }),
  catchError(err => {
    console.log('Batch processing failed, returning partial results');
    return from([
      { batch: 1, items: [1, 2, 3], processed: true, timestamp: Date.now() },
      { batch: 'recovery', items: [], processed: false, error: err.message }
    ]);
  })
);

// Provides partial results and error information
```

### Error Transformation

```typescript
const errorProneStream = new ReadableStream({
  start(controller) {
    controller.enqueue('success1');
    controller.error(new Error('NETWORK_ERROR: Connection timeout'));
  }
});

const result = await toArray(
  pipe(
    errorProneStream,
    catchError(err => {
      // Transform technical errors into user-friendly messages
      if (err.message.includes('NETWORK_ERROR')) {
        return from([{ 
          type: 'error', 
          message: 'Unable to connect. Please check your internet connection.',
          technical: err.message 
        }]);
      }
      return from([{ type: 'error', message: 'An unexpected error occurred.' }]);
    })
  )
);
// Result: ['success1', { type: 'error', message: '...' }]
```

### Logging with Error Handling

```typescript
const logStream = from([
  { level: 'info', message: 'Application started' },
  { level: 'error', message: 'Database connection failed' },
  { level: 'info', message: 'Retrying connection' }
]);

const processedLogs = pipe(
  logStream,
  map(log => {
    if (log.level === 'error' && log.message.includes('Database')) {
      throw new Error('Critical database error detected');
    }
    return { ...log, timestamp: Date.now(), processed: true };
  }),
  catchError(err => {
    return from([
      { 
        level: 'critical', 
        message: 'Log processing interrupted due to critical error',
        originalError: err.message,
        timestamp: Date.now(),
        processed: false
      }
    ]);
  })
);

// Ensures log processing continues even when critical errors are detected
```

### Multiple Error Types

```typescript
const multiErrorStream = from([1, 2, 3, 4, 5]);

const result = await toArray(
  pipe(
    multiErrorStream,
    map(x => {
      if (x === 3) throw new Error('VALIDATION_ERROR');
      if (x === 4) throw new Error('NETWORK_ERROR');
      return x * 2;
    }),
    catchError(err => {
      if (err.message === 'VALIDATION_ERROR') {
        return from(['validation-failed']);
      }
      if (err.message === 'NETWORK_ERROR') {
        return from(['network-failed']);
      }
      return from(['unknown-error']);
    })
  )
);
// Different error types trigger different fallback behaviors
```

### Nested Error Handling

```typescript
const outerStream = new ReadableStream({
  start(controller) {
    controller.enqueue('data1');
    controller.error(new Error('Outer error'));
  }
});

const result = await toArray(
  pipe(
    outerStream,
    catchError(outerErr => {
      return pipe(
        from(['fallback1', 'fallback2']),
        map(item => {
          if (item === 'fallback2') throw new Error('Inner error');
          return item;
        }),
        catchError(innerErr => from(['final-fallback']))
      );
    })
  )
);
// Nested error handling for complex recovery scenarios
```

### Resource Cleanup on Error

```typescript
let resourceHandle = null;

const resourceStream = new ReadableStream({
  start(controller) {
    resourceHandle = acquireResource();
    
    if (Math.random() > 0.5) {
      controller.error(new Error('Resource acquisition failed'));
      return;
    }
    
    controller.enqueue({ resource: 'data', handle: resourceHandle });
    controller.close();
  }
});

const result = await toArray(
  pipe(
    resourceStream,
    catchError(err => {
      // Cleanup resource on error
      if (resourceHandle) {
        releaseResource(resourceHandle);
        resourceHandle = null;
      }
      return from([{ resource: 'fallback', handle: null }]);
    })
  )
);
// Ensures proper resource cleanup even when errors occur
```

### Testing Error Scenarios

```typescript
function createTestStream(shouldError: boolean) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue('test-data');
      
      if (shouldError) {
        controller.error(new Error('Test error'));
      } else {
        controller.close();
      }
    }
  });
}

// Test error handling
const errorResult = await toArray(
  pipe(
    createTestStream(true),
    catchError(err => from(['error-handled']))
  )
);
// Result: ['test-data', 'error-handled']

// Test success path
const successResult = await toArray(
  pipe(
    createTestStream(false),
    catchError(err => from(['should-not-see-this']))
  )
);
// Result: ['test-data'] (error handler not called)
```

### Error Recovery with State

```typescript
let retryCount = 0;
const maxRetries = 3;

function createRetryableStream() {
  return new ReadableStream({
    start(controller) {
      if (retryCount < maxRetries && Math.random() > 0.7) {
        retryCount++;
        controller.error(new Error(`Attempt ${retryCount} failed`));
        return;
      }
      
      controller.enqueue({ data: 'success', attempts: retryCount });
      controller.close();
    }
  });
}

const result = await toArray(
  pipe(
    createRetryableStream(),
    catchError(err => {
      if (retryCount < maxRetries) {
        console.log(`Retrying... (${retryCount}/${maxRetries})`);
        return createRetryableStream();
      }
      return from([{ data: 'failed', attempts: retryCount, error: err.message }]);
    })
  )
);
// Implements retry logic with error recovery
```

## Key Characteristics

- **Error isolation**: Catches errors from source stream without affecting downstream
- **Stream switching**: Replaces error stream with fallback stream seamlessly
- **Selector flexibility**: Allows custom logic for determining fallback behavior
- **Type preservation**: Maintains stream type consistency
- **Resource management**: Properly handles cleanup of failed source stream

## Common Use Cases

- **Network fallbacks**: Switch to cached data when network requests fail
- **Multi-tier APIs**: Try primary API, fallback to secondary, then to cache
- **Sensor redundancy**: Switch to backup sensors when primary fails
- **Configuration loading**: Use defaults when remote config is unavailable
- **Error transformation**: Convert technical errors to user-friendly messages
- **Graceful degradation**: Provide reduced functionality when full service fails
- **Testing**: Simulate error conditions and recovery scenarios

## See Also

- [`timeout`](./timeout.md) - Error if no emission within duration
- [`retry`](../utils.md#retry) - Retry source stream on error
- [`onErrorResumeNext`](../utils.md#onErrorResumeNext) - Continue with next stream on error
- [`defaultIfEmpty`](./defaultIfEmpty.md) - Provide default for empty streams