# defaultIfEmpty

Emits a default value if the source stream completes without emitting any values. If the source stream emits any values, they are passed through unchanged.

## Type Signature

```typescript
function defaultIfEmpty<T>(defaultValue: T): (
  src: ReadableStream<T>, 
  strategy?: QueuingStrategy<T>
) => ReadableStream<T>
```

## Parameters

- `defaultValue`: The value to emit if the source stream is empty.

## Examples

### Empty Stream with Default

```typescript
const result = await toArray(
  pipe(
    empty(), // Empty stream
    defaultIfEmpty('No data available')
  )
);
// Input:  | (empty stream)
// Output: 'No data available'---|
// Result: ['No data available']
```

### Non-Empty Stream Unchanged

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3]),
    defaultIfEmpty(999) // Default not used
  )
);
// Input:  1---2---3---|
// Output: 1---2---3---|
// Result: [1, 2, 3] (default value ignored)
```

### Filtered Data with Fallback

```typescript
const numbers = from([1, 2, 3, 4, 5]);

const result = await toArray(
  pipe(
    numbers,
    filter(x => x > 10), // No numbers match
    defaultIfEmpty(-1)   // Provide fallback
  )
);
// Input:  1---2---3---4---5---|
// Filter: (none pass)
// Output: -1---|
// Result: [-1]
```

### User Preferences with Defaults

```typescript
const userPreferences = from([
  { language: 'en' },
  { theme: 'dark' }
]);

const themePreference = pipe(
  userPreferences,
  filter(pref => 'theme' in pref),
  map(pref => pref.theme),
  defaultIfEmpty('light') // Default theme
);

const result = await toArray(themePreference);
// Result: ['dark'] (user has theme preference)

// If no theme preference exists:
const noThemePrefs = from([
  { language: 'en' },
  { fontSize: 14 }
]);

const defaultTheme = await toArray(
  pipe(
    noThemePrefs,
    filter(pref => 'theme' in pref),
    map(pref => pref.theme),
    defaultIfEmpty('light')
  )
);
// Result: ['light'] (default used)
```

### API Response with Fallback Data

```typescript
async function fetchUserData(userId: string) {
  const apiResponse = new ReadableStream({
    start(controller) {
      fetch(`/api/users/${userId}`)
        .then(response => {
          if (response.status === 404) {
            // No user found, stream will be empty
            controller.close();
            return;
          }
          return response.json();
        })
        .then(data => {
          if (data) {
            controller.enqueue(data);
          }
          controller.close();
        })
        .catch(err => controller.error(err));
    }
  });

  return toArray(
    pipe(
      apiResponse,
      defaultIfEmpty({ 
        id: userId, 
        name: 'Unknown User', 
        email: 'unknown@example.com' 
      })
    )
  );
}

// Always returns user data, even if API returns empty
```

### Search Results with No Results Message

```typescript
const searchQuery = 'nonexistent term';
const searchResults = from([]); // Empty search results

const result = await toArray(
  pipe(
    searchResults,
    defaultIfEmpty({ 
      type: 'no-results',
      message: `No results found for "${searchQuery}"`,
      suggestions: ['Try different keywords', 'Check spelling'] 
    })
  )
);
// Result: [{ type: 'no-results', message: '...', suggestions: [...] }]
```

### Configuration Loading

```typescript
const configFiles = from(['config.json', 'config.yml', 'config.ini']);

const validConfig = pipe(
  configFiles,
  map(filename => {
    try {
      return loadConfigFile(filename);
    } catch {
      return null; // File doesn't exist or invalid
    }
  }),
  filter(config => config !== null),
  defaultIfEmpty({
    version: '1.0.0',
    environment: 'development',
    debug: true,
    database: { host: 'localhost', port: 5432 }
  })
);

// Always provides a valid configuration
```

### Database Query Results

```typescript
async function findUsersByRole(role: string) {
  const queryResults = new ReadableStream({
    start(controller) {
      executeQuery(`SELECT * FROM users WHERE role = ?`, [role])
        .then(rows => {
          rows.forEach(row => controller.enqueue(row));
          controller.close();
        })
        .catch(err => controller.error(err));
    }
  });

  return toArray(
    pipe(
      queryResults,
      defaultIfEmpty({
        id: null,
        role: role,
        message: `No users found with role: ${role}`,
        isEmpty: true
      })
    )
  );
}

// Always returns at least one result indicating query status
```

### File Processing with Empty File Handling

```typescript
const fileLines = new ReadableStream({
  start(controller) {
    // Simulate reading a potentially empty file
    const lines = readFileLines('data.txt');
    if (lines.length === 0) {
      controller.close(); // Empty file
      return;
    }
    lines.forEach(line => controller.enqueue(line));
    controller.close();
  }
});

const result = await toArray(
  pipe(
    fileLines,
    defaultIfEmpty('# Empty file - no data to process')
  )
);
// Provides indication when file is empty
```

### Form Validation Messages

```typescript
const validationErrors = from([
  // Assume validation found no errors
]);

const validationResult = pipe(
  validationErrors,
  defaultIfEmpty({
    type: 'success',
    message: 'All fields are valid',
    errors: [],
    isValid: true
  })
);

// Provides positive feedback when no errors exist
```

### Sensor Data with Offline Indicator

```typescript
const sensorReadings = new ReadableStream({
  start(controller) {
    // Simulate sensor that might be offline
    const isOnline = Math.random() > 0.5;
    
    if (!isOnline) {
      controller.close(); // No readings available
      return;
    }
    
    // Provide some readings
    for (let i = 0; i < 5; i++) {
      controller.enqueue({
        temperature: 20 + Math.random() * 10,
        timestamp: Date.now() + i * 1000
      });
    }
    controller.close();
  }
});

const result = await toArray(
  pipe(
    sensorReadings,
    defaultIfEmpty({
      temperature: null,
      timestamp: Date.now(),
      status: 'offline',
      message: 'Sensor is currently unavailable'
    })
  )
);
// Indicates when sensor is offline
```

### Shopping Cart Items

```typescript
const cartItems = from([]); // Empty cart

const cartDisplay = pipe(
  cartItems,
  defaultIfEmpty({
    id: 'empty-cart-message',
    type: 'message',
    content: 'Your cart is empty',
    action: 'Start shopping',
    link: '/products'
  })
);

// Provides empty cart message and call-to-action
```

### Notification Stream

```typescript
const urgentNotifications = from([
  // No urgent notifications today
]);

const notificationDisplay = pipe(
  urgentNotifications,
  defaultIfEmpty({
    id: 'no-notifications',
    type: 'info',
    title: 'All caught up!',
    message: 'No urgent notifications at this time',
    icon: 'check-circle'
  })
);

// Shows positive message when no urgent notifications
```

### Analytics Data

```typescript
const todaysEvents = from([
  // No events tracked today
]);

const analyticsReport = pipe(
  todaysEvents,
  defaultIfEmpty({
    date: new Date().toISOString().split('T')[0],
    events: 0,
    message: 'No events recorded today',
    suggestion: 'Check tracking implementation'
  })
);

// Provides report even when no data is available
```

### Chat Messages

```typescript
const recentMessages = from([
  // No recent messages in chat
]);

const chatDisplay = pipe(
  recentMessages,
  defaultIfEmpty({
    id: 'welcome-message',
    type: 'system',
    message: 'Welcome to the chat! Start a conversation.',
    timestamp: Date.now(),
    author: 'System'
  })
);

// Shows welcome message in empty chat rooms
```

### API Endpoint Discovery

```typescript
const availableEndpoints = from([
  // API discovery returned no endpoints
]);

const endpointList = pipe(
  availableEndpoints,
  defaultIfEmpty({
    endpoint: '/health',
    method: 'GET',
    description: 'Health check endpoint (always available)',
    isDefault: true
  })
);

// Provides fallback endpoint when discovery fails
```

### Performance Metrics

```typescript
const errorMetrics = from([
  // No errors in the last hour
]);

const metricsReport = pipe(
  errorMetrics,
  defaultIfEmpty({
    timeframe: 'last hour',
    errorCount: 0,
    status: 'healthy',
    message: 'No errors detected',
    uptime: '100%'
  })
);

// Shows positive status when no errors occur
```

### Multiple Defaults for Different Types

```typescript
interface User {
  id: string;
  name: string;
  email: string;
}

interface UserError {
  error: string;
  code: number;
}

const userStream = from<User | UserError>([]);

const result = await toArray(
  pipe(
    userStream,
    defaultIfEmpty({
      error: 'No user data available',
      code: 404
    } as UserError)
  )
);
// Type-safe default for union types
```

### Chaining with Other Operators

```typescript
const data = from([1, 2, 3, 4, 5]);

const result = await toArray(
  pipe(
    data,
    filter(x => x > 10),     // Results in empty stream
    map(x => x * 2),         // Never executes
    defaultIfEmpty(0),       // Provides default
    map(x => `Value: ${x}`)  // Processes default
  )
);
// Result: ['Value: 0']
```

### Error Handling

```typescript
const errorStream = new ReadableStream({
  start(controller) {
    controller.error(new Error('Stream error'));
  }
});

const result = await toArray(
  pipe(
    errorStream,
    defaultIfEmpty('default'), // Not called on error
    catchError(err => from(['error-handled']))
  )
);
// Result: ['error-handled']
// defaultIfEmpty doesn't execute when stream errors
```

### Testing Empty Streams

```typescript
function testDefaultBehavior() {
  // Test with empty stream
  const emptyResult = await toArray(
    pipe(
      empty(),
      defaultIfEmpty('test-default')
    )
  );
  console.assert(emptyResult[0] === 'test-default');

  // Test with non-empty stream
  const nonEmptyResult = await toArray(
    pipe(
      from(['data']),
      defaultIfEmpty('test-default')
    )
  );
  console.assert(nonEmptyResult[0] === 'data');
}

// Verify default behavior in tests
```

### Conditional Defaults

```typescript
function conditionalDefault<T>(condition: boolean, defaultValue: T) {
  return condition 
    ? defaultIfEmpty(defaultValue)
    : (stream: ReadableStream<T>) => stream;
}

const data = from([]);

const result = await toArray(
  pipe(
    data,
    conditionalDefault(true, 'conditional-default')
  )
);
// Result: ['conditional-default']
```

## Key Characteristics

- **Empty stream detection**: Only activates when source completes without emitting
- **Transparent passthrough**: Non-empty streams are unaffected
- **Single emission**: Default value is emitted once when needed
- **Type consistency**: Default value must match stream type
- **Completion preservation**: Stream completes after emitting default or passthrough values

## Common Use Cases

- **Fallback data**: Provide default values when data sources are empty
- **User interfaces**: Show "no data" messages or empty state content
- **Configuration**: Ensure valid configuration even when files are missing
- **API responses**: Provide meaningful responses for empty result sets
- **Search results**: Show "no results found" messages with suggestions
- **Form validation**: Provide success messages when no errors exist
- **Analytics**: Report zero-state metrics and status
- **Error prevention**: Avoid empty collections in processing pipelines

## See Also

- [`startWith`](./startWith.md) - Prepend values to stream (always emits)
- [`catchError`](./catchError.md) - Handle errors with fallback stream
- [`filter`](./filter.md) - Filter values (may result in empty streams)
- [`empty`](../creation.md#empty) - Create empty streams