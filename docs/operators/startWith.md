# startWith

Prepends the specified values to the beginning of the source stream. The prepended values are emitted first, followed by all values from the source stream.

## Type Signature

```typescript
function startWith<T>(...values: T[]): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T>
```

## Parameters

- `...values`: Values to prepend to the stream. Can be any number of values of type `T`.

## Examples

### Basic Prepending

```typescript
const result = await toArray(
  pipe(
    from([3, 4, 5]),
    startWith(1, 2)
  )
);
// Original: 3---4---5---|
// Output:   1---2---3---4---5---|
// Result: [1, 2, 3, 4, 5]
```

### Single Value Prepend

```typescript
const result = await toArray(
  pipe(
    from(['world', '!']),
    startWith('hello')
  )
);
// Result: ['hello', 'world', '!']
```

### Multiple Values Prepend

```typescript
const result = await toArray(
  pipe(
    from([4, 5, 6]),
    startWith(1, 2, 3)
  )
);
// Result: [1, 2, 3, 4, 5, 6]
```

### Configuration with Defaults

```typescript
const userSettings = from([
  { theme: 'dark' },
  { language: 'es' }
]);

const settingsWithDefaults = pipe(
  userSettings,
  startWith(
    { version: '1.0', mode: 'production' },
    { theme: 'light', language: 'en' }
  )
);

const result = await toArray(settingsWithDefaults);
// Result: [
//   { version: '1.0', mode: 'production' },
//   { theme: 'light', language: 'en' },
//   { theme: 'dark' },
//   { language: 'es' }
// ]
```

### API Response with Headers

```typescript
const responseData = from([
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' }
]);

const apiResponse = pipe(
  responseData,
  startWith(
    { meta: { total: 2, page: 1 } },
    { headers: { 'Content-Type': 'application/json' } }
  )
);

// Prepends metadata before actual data
```

### Loading State Management

```typescript
const asyncData = timer(2000).pipe(
  map(() => ({ data: 'loaded content', status: 'success' }))
);

const dataWithLoadingState = pipe(
  asyncData,
  startWith({ data: null, status: 'loading' })
);

for await (const state of dataWithLoadingState) {
  console.log('Current state:', state);
}
// First emits loading state, then loaded data
```

### Navigation Breadcrumbs

```typescript
const currentPath = from([
  { name: 'Users', url: '/users' },
  { name: 'Profile', url: '/users/profile' }
]);

const breadcrumbs = pipe(
  currentPath,
  startWith({ name: 'Home', url: '/' })
);

const result = await toArray(breadcrumbs);
// Result: [
//   { name: 'Home', url: '/' },
//   { name: 'Users', url: '/users' },
//   { name: 'Profile', url: '/users/profile' }
// ]
```

### Game High Scores

```typescript
const newScores = from([
  { player: 'Alice', score: 850 },
  { player: 'Bob', score: 920 }
]);

const allScores = pipe(
  newScores,
  startWith(
    { player: 'Previous Champion', score: 1000 },
    { player: 'Hall of Fame', score: 950 }
  )
);

// Maintains previous high scores before adding new ones
```

### Log Entry Context

```typescript
const applicationLogs = from([
  { level: 'info', message: 'User logged in' },
  { level: 'warn', message: 'Low memory warning' }
]);

const logsWithContext = pipe(
  applicationLogs,
  startWith(
    { level: 'system', message: 'Application started' },
    { level: 'info', message: 'Configuration loaded' }
  )
);

// Provides startup context for log analysis
```

### Shopping Cart with Promotions

```typescript
const cartItems = from([
  { product: 'Laptop', price: 999 },
  { product: 'Mouse', price: 25 }
]);

const cartWithPromotions = pipe(
  cartItems,
  startWith(
    { product: 'Free Shipping', price: 0, type: 'promotion' },
    { product: '10% Discount', price: -100, type: 'discount' }
  )
);

// Applies promotions before regular items
```

### Database Query Results

```typescript
const dataRows = from([
  { id: 1, name: 'Alice', age: 25 },
  { id: 2, name: 'Bob', age: 30 }
]);

const resultsWithMetadata = pipe(
  dataRows,
  startWith(
    { metadata: true, query: 'SELECT * FROM users', timestamp: Date.now() },
    { metadata: true, totalRows: 2, executionTime: '15ms' }
  )
);

// Includes query metadata before actual results
```

### Event Stream with Initial State

```typescript
const userEvents = from([
  { type: 'click', target: 'button1' },
  { type: 'scroll', position: 100 }
]);

const eventsWithInitialState = pipe(
  userEvents,
  startWith(
    { type: 'init', timestamp: Date.now() },
    { type: 'page_load', url: window.location.href }
  )
);

// Captures initial context for event analysis
```

### File Processing with Headers

```typescript
const csvData = from([
  'John,25,Engineer',
  'Jane,30,Designer',
  'Bob,35,Manager'
]);

const csvWithHeaders = pipe(
  csvData,
  startWith(
    'Name,Age,Position', // CSV header
    '# Generated on ' + new Date().toISOString() // Comment
  )
);

// Adds headers and metadata to file output
```

### Animation Sequence

```typescript
const animationFrames = from([
  { frame: 3, x: 30, y: 0 },
  { frame: 4, x: 40, y: 0 },
  { frame: 5, x: 50, y: 0 }
]);

const completeAnimation = pipe(
  animationFrames,
  startWith(
    { frame: 0, x: 0, y: 0 },   // Starting position
    { frame: 1, x: 10, y: 0 },  // Initial movement
    { frame: 2, x: 20, y: 0 }   // Acceleration
  )
);

// Creates complete animation sequence from beginning
```

### API Error Handling

```typescript
const apiCalls = from([
  fetch('/api/data1'),
  fetch('/api/data2')
]);

const requestsWithFallback = pipe(
  apiCalls,
  startWith(
    Promise.resolve({ cached: true, data: 'fallback' }),
    Promise.resolve({ cached: true, data: 'backup' })
  )
);

// Provides fallback data before attempting API calls
```

### Form Validation States

```typescript
const validationResults = from([
  { field: 'email', valid: true },
  { field: 'password', valid: false }
]);

const validationWithDefaults = pipe(
  validationResults,
  startWith(
    { field: 'form', valid: true, message: 'Starting validation' },
    { field: 'required', valid: true, message: 'All required fields present' }
  )
);

// Establishes validation context and initial state
```

### Sensor Calibration

```typescript
const sensorReadings = interval(1000).pipe(
  map(() => ({ temp: 20 + Math.random() * 10, humidity: 50 + Math.random() * 20 })),
  take(5)
);

const calibratedReadings = pipe(
  sensorReadings,
  startWith(
    { temp: 0, humidity: 0, status: 'calibrating' },
    { temp: 20, humidity: 50, status: 'baseline' }
  )
);

// Provides calibration baseline before actual readings
```

### Chat Message History

```typescript
const newMessages = from([
  { user: 'Alice', message: 'How are you?', timestamp: Date.now() },
  { user: 'Bob', message: 'Great! Thanks for asking.', timestamp: Date.now() + 1000 }
]);

const chatWithHistory = pipe(
  newMessages,
  startWith(
    { user: 'System', message: 'Chat session started', timestamp: Date.now() - 5000 },
    { user: 'Alice', message: 'Hello!', timestamp: Date.now() - 3000 }
  )
);

// Maintains chat context with previous messages
```

### Empty Stream Handling

```typescript
const result = await toArray(
  pipe(
    from([]), // Empty stream
    startWith('default', 'fallback')
  )
);
// Result: ['default', 'fallback'] (only prepended values)
```

### Type Safety Example

```typescript
interface User {
  name: string;
  age: number;
}

const users = from<User>([
  { name: 'Alice', age: 25 },
  { name: 'Bob', age: 30 }
]);

const usersWithAdmin = pipe(
  users,
  startWith({ name: 'Admin', age: 0 }) // Type-safe prepending
);

// TypeScript ensures all values match User interface
```

### Performance Considerations

```typescript
// startWith values are emitted immediately
const performanceTest = pipe(
  timer(5000), // Slow source
  startWith('immediate1', 'immediate2', 'immediate3')
);

// First 3 values are available immediately, 
// 4th value comes after 5 seconds
```

### Combining Multiple startWith Operations

```typescript
const base = from([5, 6]);

const extended = pipe(
  base,
  startWith(3, 4),  // First prepend
  startWith(1, 2)   // Second prepend
);

const result = await toArray(extended);
// Result: [1, 2, 3, 4, 5, 6]
// Multiple startWith operations are applied in order
```

### Error Handling

```typescript
const errorStream = new ReadableStream({
  start(controller) {
    setTimeout(() => controller.error(new Error('Source error')), 1000);
  }
});

const result = await toArray(
  pipe(
    errorStream,
    startWith('safe-value'),
    catchError(err => from(['error-handled']))
  )
);
// Result: ['safe-value', 'error-handled']
// Prepended values are emitted before error occurs
```

### Conditional Prepending

```typescript
function conditionalStart<T>(condition: boolean, ...values: T[]) {
  return condition ? startWith(...values) : (stream: ReadableStream<T>) => stream;
}

const data = from([3, 4, 5]);
const result = await toArray(
  pipe(
    data,
    conditionalStart(true, 1, 2) // Only prepend if condition is true
  )
);
// Result: [1, 2, 3, 4, 5]
```

## Key Characteristics

- **Immediate emission**: Prepended values are emitted immediately when stream starts
- **Order preservation**: Prepended values appear in the order specified
- **Type consistency**: All prepended values must match stream type
- **Source independence**: Prepended values don't depend on source stream
- **Error isolation**: Prepended values are emitted even if source fails later

## Common Use Cases

- **Default values**: Provide initial values or fallbacks
- **Headers/metadata**: Add context information to data streams
- **Loading states**: Show initial states before async data arrives
- **Configuration**: Prepend default settings before user preferences
- **Navigation**: Add root items to breadcrumb paths
- **Logging**: Add context or startup information to log streams
- **API responses**: Include metadata before actual data

## See Also

- [`buffer`](./buffer.md) - Collect values into arrays
- [`concat`](../creation.md#concat) - Concatenate multiple streams
- [`merge`](../combination.md#merge) - Combine streams concurrently
- [`defaultIfEmpty`](./defaultIfEmpty.md) - Provide default for empty streams