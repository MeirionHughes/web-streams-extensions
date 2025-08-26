# distinctUntilKeyChanged

Only emits values when the selected key differs from the previous value's key. Uses strict equality by default on the selected key, or a custom comparison function. Unlike `distinct`, this only compares with the immediately previous value, not all previously seen values.

## Type Signature

```typescript
function distinctUntilKeyChanged<T, K extends keyof T>(
  key: K
): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T>

function distinctUntilKeyChanged<T, K extends keyof T>(
  key: K,
  compare: (x: T[K], y: T[K]) => boolean
): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T>
```

## Parameters

- `key`: The property key to select from each item for comparison
- `compare` *(optional)*: Custom comparison function for the selected key values. Defaults to strict equality (`===`)

## Examples

### Basic Usage with ID Key

```typescript
const result = await toArray(
  pipe(
    from([
      { id: 1, name: 'Alice' },
      { id: 1, name: 'Alice Updated' },
      { id: 2, name: 'Bob' },
      { id: 2, name: 'Bob Updated' },
      { id: 1, name: 'Alice Again' }
    ]),
    distinctUntilKeyChanged('id')
  )
);
// Input:  {id:1}---{id:1}---{id:2}---{id:2}---{id:1}---|
// Output: {id:1}----------{id:2}----------{id:1}---|
// Result: [
//   { id: 1, name: 'Alice' },
//   { id: 2, name: 'Bob' },
//   { id: 1, name: 'Alice Again' }
// ]
```

### User Status Changes

```typescript
const userStates = from([
  { user: 'Alice', status: 'online', timestamp: 100 },
  { user: 'Alice', status: 'online', timestamp: 150 },  // Same status
  { user: 'Alice', status: 'away', timestamp: 200 },
  { user: 'Alice', status: 'away', timestamp: 250 },   // Same status
  { user: 'Alice', status: 'offline', timestamp: 300 },
  { user: 'Alice', status: 'online', timestamp: 350 }
]);

const statusChanges = await toArray(
  pipe(
    userStates,
    distinctUntilKeyChanged('status')
  )
);
// Result: Only when status actually changes
// [online@100, away@200, offline@300, online@350]
```

### Game Player State Tracking

```typescript
const playerStates = from([
  { player: 'Player1', state: 'idle', level: 1 },
  { player: 'Player1', state: 'idle', level: 1 },    // Same state
  { player: 'Player1', state: 'moving', level: 1 },
  { player: 'Player1', state: 'moving', level: 1 },  // Same state
  { player: 'Player1', state: 'fighting', level: 2 },
  { player: 'Player1', state: 'idle', level: 2 }
]);

const stateChanges = await toArray(
  pipe(
    playerStates,
    distinctUntilKeyChanged('state')
  )
);
// Result: [idle, moving, fighting, idle] - only state transitions
```

### Custom Comparison Function

```typescript
const items = from([
  { name: 'Foo1', category: 'A' },
  { name: 'Foo2', category: 'A' },
  { name: 'Bar', category: 'B' },
  { name: 'Foo3', category: 'A' }
]);

const result = await toArray(
  pipe(
    items,
    distinctUntilKeyChanged('name', (x, y) => x.substring(0, 3) === y.substring(0, 3))
  )
);
// Input:  Foo1---Foo2---Bar---Foo3---|
// Output: Foo1----------Bar---Foo3---|
// Result: [Foo1, Bar, Foo3] (Foo2 filtered, same prefix as Foo1)
```

### Network Connection States

```typescript
const connectionEvents = from([
  { type: 'connection', state: 'connecting', signal: 2 },
  { type: 'connection', state: 'connecting', signal: 3 },  // Same state
  { type: 'connection', state: 'connected', signal: 4 },
  { type: 'connection', state: 'connected', signal: 5 },   // Same state
  { type: 'connection', state: 'disconnected', signal: 0 },
  { type: 'connection', state: 'connecting', signal: 1 }
]);

const stateTransitions = await toArray(
  pipe(
    connectionEvents,
    distinctUntilKeyChanged('state')
  )
);
// Result: Only actual state changes, not signal strength updates
```

### Shopping Cart Status

```typescript
const cartUpdates = from([
  { items: 0, status: 'empty', total: 0 },
  { items: 1, status: 'active', total: 25 },
  { items: 2, status: 'active', total: 50 },    // Same status
  { items: 3, status: 'active', total: 75 },    // Same status
  { items: 0, status: 'empty', total: 0 },
  { items: 1, status: 'active', total: 30 }
]);

const statusChanges = await toArray(
  pipe(
    cartUpdates,
    distinctUntilKeyChanged('status')
  )
);
// Result: [empty, active, empty, active] - status transitions only
```

### Temperature Sensor Zones

```typescript
const sensorReadings = from([
  { sensor: 'S1', zone: 'cold', temp: 15 },
  { sensor: 'S1', zone: 'cold', temp: 16 },     // Same zone
  { sensor: 'S1', zone: 'warm', temp: 22 },
  { sensor: 'S1', zone: 'warm', temp: 24 },     // Same zone
  { sensor: 'S1', zone: 'hot', temp: 32 },
  { sensor: 'S1', zone: 'warm', temp: 26 }
]);

const zoneChanges = await toArray(
  pipe(
    sensorReadings,
    distinctUntilKeyChanged('zone')
  )
);
// Result: Only when sensor moves between temperature zones
```

### Case-Insensitive String Comparison

```typescript
const textChanges = from([
  { text: 'Hello', category: 'greeting' },
  { text: 'HELLO', category: 'greeting' },
  { text: 'world', category: 'noun' },
  { text: 'World', category: 'noun' },
  { text: 'goodbye', category: 'farewell' }
]);

const result = await toArray(
  pipe(
    textChanges,
    distinctUntilKeyChanged('text', (a, b) => a.toLowerCase() === b.toLowerCase())
  )
);
// Result: [Hello, world, goodbye] - case-insensitive text comparison
```

### API Response Status Codes

```typescript
const apiResponses = from([
  { endpoint: '/users', status: 200, data: 'users1' },
  { endpoint: '/users', status: 200, data: 'users2' },    // Same status
  { endpoint: '/users', status: 404, data: null },
  { endpoint: '/users', status: 404, data: null },        // Same status
  { endpoint: '/users', status: 200, data: 'users3' },
  { endpoint: '/users', status: 500, data: 'error' }
]);

const statusChanges = await toArray(
  pipe(
    apiResponses,
    distinctUntilKeyChanged('status')
  )
);
// Result: Only when HTTP status actually changes
```

### Media Player State

```typescript
const playerEvents = from([
  { track: 'Song1', state: 'playing', position: 0 },
  { track: 'Song1', state: 'playing', position: 10 },   // Same state
  { track: 'Song1', state: 'paused', position: 15 },
  { track: 'Song1', state: 'paused', position: 15 },    // Same state
  { track: 'Song1', state: 'playing', position: 15 },
  { track: 'Song2', state: 'playing', position: 0 }
]);

const stateTransitions = await toArray(
  pipe(
    playerEvents,
    distinctUntilKeyChanged('state')
  )
);
// Result: [playing, paused, playing] - ignores position updates
```

### Order Processing Pipeline

```typescript
const orderUpdates = from([
  { orderId: 'O1', stage: 'pending', timestamp: 100 },
  { orderId: 'O1', stage: 'pending', timestamp: 150 },     // Same stage
  { orderId: 'O1', stage: 'processing', timestamp: 200 },
  { orderId: 'O1', stage: 'processing', timestamp: 250 },  // Same stage
  { orderId: 'O1', stage: 'shipped', timestamp: 300 },
  { orderId: 'O1', stage: 'delivered', timestamp: 400 }
]);

const stageChanges = await toArray(
  pipe(
    orderUpdates,
    distinctUntilKeyChanged('stage')
  )
);
// Result: Key pipeline transitions only
```

### Custom Object Comparison

```typescript
const configs = from([
  { app: 'MyApp', theme: { name: 'dark', version: 1 }, user: 'Alice' },
  { app: 'MyApp', theme: { name: 'dark', version: 2 }, user: 'Alice' },  // Same theme name
  { app: 'MyApp', theme: { name: 'light', version: 1 }, user: 'Alice' },
  { app: 'MyApp', theme: { name: 'light', version: 1 }, user: 'Bob' },   // Same theme object
  { app: 'MyApp', theme: { name: 'dark', version: 1 }, user: 'Bob' }
]);

const themeChanges = await toArray(
  pipe(
    configs,
    distinctUntilKeyChanged('theme', (a, b) => a.name === b.name)
  )
);
// Result: Only when theme name changes, ignoring version
```

### Stock Price Trend Direction

```typescript
const stockPrices = from([
  { symbol: 'AAPL', price: 150, trend: 'up' },
  { symbol: 'AAPL', price: 155, trend: 'up' },      // Same trend
  { symbol: 'AAPL', price: 148, trend: 'down' },
  { symbol: 'AAPL', price: 145, trend: 'down' },    // Same trend
  { symbol: 'AAPL', price: 152, trend: 'up' },
  { symbol: 'AAPL', price: 152, trend: 'flat' }
]);

const trendChanges = await toArray(
  pipe(
    stockPrices,
    distinctUntilKeyChanged('trend')
  )
);
// Result: [up, down, up, flat] - trend direction changes only
```

### User Permission Level Changes

```typescript
const userPermissions = from([
  { user: 'Alice', level: 'read', granted: true },
  { user: 'Alice', level: 'read', granted: true },    // Same level
  { user: 'Alice', level: 'write', granted: true },
  { user: 'Alice', level: 'write', granted: false },  // Same level (different granted)
  { user: 'Alice', level: 'admin', granted: true },
  { user: 'Alice', level: 'read', granted: true }
]);

const levelChanges = await toArray(
  pipe(
    userPermissions,
    distinctUntilKeyChanged('level')
  )
);
// Result: [read, write, admin, read] - permission level changes
```

### Numeric Range Comparison

```typescript
const measurements = from([
  { sensor: 'temp1', value: 20.1, range: 'normal' },
  { sensor: 'temp1', value: 20.5, range: 'normal' },   // Same range
  { sensor: 'temp1', value: 25.2, range: 'high' },
  { sensor: 'temp1', value: 26.1, range: 'high' },     // Same range
  { sensor: 'temp1', value: 18.5, range: 'low' }
]);

const rangeChanges = await toArray(
  pipe(
    measurements,
    distinctUntilKeyChanged('range')
  )
);
// Result: [normal, high, low] - range category changes only
```

### Subscription Status Tracking

```typescript
const subscriptions = from([
  { user: 'Alice', plan: 'free', expires: null },
  { user: 'Alice', plan: 'free', expires: null },       // Same plan
  { user: 'Alice', plan: 'premium', expires: '2024-12-31' },
  { user: 'Alice', plan: 'premium', expires: '2025-01-31' }, // Same plan
  { user: 'Alice', plan: 'enterprise', expires: '2025-12-31' },
  { user: 'Alice', plan: 'free', expires: null }
]);

const planChanges = await toArray(
  pipe(
    subscriptions,
    distinctUntilKeyChanged('plan')
  )
);
// Result: [free, premium, enterprise, free] - plan changes only
```

### Data Quality Score Ranges

```typescript
const qualityReports = from([
  { dataset: 'D1', score: 0.95, grade: 'A' },
  { dataset: 'D1', score: 0.93, grade: 'A' },    // Same grade
  { dataset: 'D1', score: 0.85, grade: 'B' },
  { dataset: 'D1', score: 0.82, grade: 'B' },    // Same grade
  { dataset: 'D1', score: 0.65, grade: 'C' },
  { dataset: 'D1', score: 0.91, grade: 'A' }
]);

const gradeChanges = await toArray(
  pipe(
    qualityReports,
    distinctUntilKeyChanged('grade')
  )
);
// Result: [A, B, C, A] - quality grade transitions
```

### Combining with Other Operators

```typescript
const events = from([
  { type: 'click', target: 'button1', priority: 'high' },
  { type: 'click', target: 'button2', priority: 'high' },   // Same priority
  { type: 'scroll', target: 'page', priority: 'low' },
  { type: 'hover', target: 'menu', priority: 'low' },       // Same priority
  { type: 'keypress', target: 'input', priority: 'medium' },
  { type: 'resize', target: 'window', priority: 'high' }
]);

const priorityChanges = await toArray(
  pipe(
    events,
    distinctUntilKeyChanged('priority'),
    map(event => ({ priority: event.priority, eventType: event.type }))
  )
);
// Result: Priority level changes with first event of each priority
```

### Error Handling

```typescript
const dataWithErrors = from([
  { id: 1, status: 'active' },
  { id: 2, status: 'inactive' },
  null, // Will cause error when accessing .status
  { id: 3, status: 'pending' }
]);

const result = await toArray(
  pipe(
    dataWithErrors,
    distinctUntilKeyChanged('status'),
    catchError(err => from([{ id: -1, status: 'error' }]))
  )
);
// Error accessing key on null value propagates through stream
```

### Performance with Large Objects

```typescript
const largeObjects = range(1, 1000).pipe(
  map(i => ({
    id: i,
    category: `cat-${Math.floor(i / 10)}`, // Categories repeat every 10 items
    data: new Array(1000).fill(i) // Large data array
  }))
);

const categoryChanges = await toArray(
  pipe(
    largeObjects,
    distinctUntilKeyChanged('category'), // Only compares category string
    take(20)
  )
);
// Efficient: only compares the category key, not entire large objects
```

### Testing Consecutive Behavior

```typescript
const testData = from([1, 1, 2, 2, 1, 1, 3, 3, 2]);

const objectData = pipe(
  testData,
  map(value => ({ id: value, data: `item-${value}` }))
);

const result = await toArray(
  pipe(
    objectData,
    distinctUntilKeyChanged('id')
  )
);
// Input:  1---1---2---2---1---1---3---3---2---|
// Output: 1-------2-------1-------3-------2---|
// Result: Values when ID changes from previous (allows repeats after gaps)
```

### Configuration File Monitoring

```typescript
const configChanges = from([
  { file: 'app.json', section: 'database', lastMod: 100 },
  { file: 'app.json', section: 'database', lastMod: 150 },  // Same section
  { file: 'app.json', section: 'api', lastMod: 200 },
  { file: 'app.json', section: 'api', lastMod: 250 },       // Same section
  { file: 'app.json', section: 'ui', lastMod: 300 },
  { file: 'app.json', section: 'database', lastMod: 350 }   // Back to database
]);

const sectionChanges = await toArray(
  pipe(
    configChanges,
    distinctUntilKeyChanged('section')
  )
);
// Result: Only when editing different config sections
```

## Key Characteristics

- **Consecutive comparison**: Only compares with immediately previous value, not all history
- **Memory efficient**: Only stores the previous key value, not all seen values
- **Order preservation**: Maintains original stream order
- **Key flexibility**: Works with any object property as comparison key
- **Custom comparison**: Supports custom comparison functions for complex key types
- **Re-emission allowed**: Same values can be emitted again after different values

## Common Use Cases

- **State change detection**: Track only actual state transitions, not updates within same state
- **Event deduplication**: Filter consecutive duplicate events while allowing later re-occurrences
- **Status monitoring**: Monitor status changes without noise from repeated status reports
- **Performance optimization**: Reduce processing when key properties haven't changed
- **UI updates**: Only trigger UI updates when displayed values actually change
- **Data stream filtering**: Remove consecutive duplicates while preserving overall patterns
- **Configuration monitoring**: Track configuration section changes
- **Quality assurance**: Monitor state transitions in testing scenarios

## See Also

- [`distinctUntilChanged`](./distinctUntilChanged.md) - Compare entire values consecutively
- [`distinct`](./distinct.md) - Global uniqueness across entire stream
- [`filter`](./filter.md) - General value filtering
- [`groupBy`](../utils.md#groupBy) - Group values by key