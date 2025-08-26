# distinctUntilChanged

Only emits when the current value is different from the previous value. Uses strict equality (===) by default, or a custom comparison function. Useful for filtering out consecutive duplicate values.

## Type Signature

```typescript
function distinctUntilChanged<T>(
  compare?: (previous: T, current: T) => boolean
): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T>
```

## Parameters

- `compare`: Optional comparison function that returns `true` if values are considered equal. Defaults to strict equality (`===`).

## Examples

### Basic Deduplication

```typescript
const result = await toArray(
  pipe(
    from([1, 1, 2, 2, 2, 3, 3, 1, 1]),
    distinctUntilChanged()
  )
);
// Input:  1---1---2---2---2---3---3---1---1---|
// Output: 1-------2-----------3-------1-------|
// Result: [1, 2, 3, 1]
```

### String Deduplication

```typescript
const result = await toArray(
  pipe(
    from(['hello', 'hello', 'world', 'world', 'hello']),
    distinctUntilChanged()
  )
);
// Input:  hello--hello--world--world--hello---|
// Output: hello---------world---------hello---|
// Result: ['hello', 'world', 'hello']
```

### Custom Comparison Function

```typescript
const result = await toArray(
  pipe(
    from(['Hello', 'HELLO', 'world', 'WORLD', 'foo']),
    distinctUntilChanged((prev, curr) => 
      prev.toLowerCase() === curr.toLowerCase()
    )
  )
);
// Input:  Hello--HELLO--world--WORLD--foo---|
// Output: Hello---------world---------foo---|
// Result: ['Hello', 'world', 'foo']
```

### Object Comparison

```typescript
const users = from([
  { id: 1, name: 'Alice' },
  { id: 1, name: 'Alice' },  // Different object, same content
  { id: 2, name: 'Bob' },
  { id: 2, name: 'Bob' },
  { id: 1, name: 'Alice' }   // Different ID sequence
]);

const result = await toArray(
  pipe(
    users,
    distinctUntilChanged((prev, curr) => 
      prev.id === curr.id && prev.name === curr.name
    )
  )
);
// Compares by content, not reference
// Result: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }, { id: 1, name: 'Alice' }]
```

### State Change Detection

```typescript
const gameStates = from([
  { level: 1, score: 0 },
  { level: 1, score: 10 },
  { level: 1, score: 10 },  // No change
  { level: 2, score: 10 },  // Level changed
  { level: 2, score: 25 },
  { level: 2, score: 25 }   // No change
]);

const levelChanges = await toArray(
  pipe(
    gameStates,
    distinctUntilChanged((prev, curr) => prev.level === curr.level)
  )
);
// Only emit when level changes
// Result: [{ level: 1, score: 0 }, { level: 2, score: 10 }]
```

### Sensor Reading Filtering

```typescript
const sensorReadings = from([
  { temperature: 20.1, humidity: 45 },
  { temperature: 20.1, humidity: 45 },  // Duplicate
  { temperature: 20.2, humidity: 45 },  // Temperature changed
  { temperature: 20.2, humidity: 46 },  // Humidity changed
  { temperature: 20.2, humidity: 46 }   // Duplicate
]);

const significantChanges = await toArray(
  pipe(
    sensorReadings,
    distinctUntilChanged((prev, curr) =>
      Math.abs(prev.temperature - curr.temperature) < 0.1 &&
      Math.abs(prev.humidity - curr.humidity) < 1
    )
  )
);
// Only emit when readings change significantly
```

### UI State Management

```typescript
const uiStates = from([
  { isLoading: false, error: null },
  { isLoading: true, error: null },
  { isLoading: true, error: null },   // No change
  { isLoading: false, error: null },
  { isLoading: false, error: 'Network failed' },
  { isLoading: false, error: 'Network failed' }  // No change
]);

const stateChanges = await toArray(
  pipe(
    uiStates,
    distinctUntilChanged((prev, curr) =>
      prev.isLoading === curr.isLoading && prev.error === curr.error
    )
  )
);
// Only emit when UI state actually changes
```

### Number Tolerance Comparison

```typescript
const measurements = from([1.0, 1.01, 1.02, 1.1, 1.11, 2.0, 2.01]);

const tolerantDistinct = await toArray(
  pipe(
    measurements,
    distinctUntilChanged((prev, curr) => 
      Math.abs(prev - curr) < 0.05  // 5% tolerance
    )
  )
);
// Input:  1.0--1.01--1.02--1.1--1.11--2.0--2.01---|
// Output: 1.0---------1.1-------2.0-------------|
// Result: [1.0, 1.1, 2.0] (small changes ignored)
```

### Boolean State Changes

```typescript
const toggleStates = from([false, false, true, true, true, false, false, true]);

const toggleChanges = await toArray(
  pipe(
    toggleStates,
    distinctUntilChanged()
  )
);
// Input:  F---F---T---T---T---F---F---T---|
// Output: F-------T-----------F-------T---|
// Result: [false, true, false, true]
```

### Complex Object Comparison

```typescript
const complexObjects = from([
  { user: { id: 1 }, settings: { theme: 'dark' } },
  { user: { id: 1 }, settings: { theme: 'dark' } },  // Same content
  { user: { id: 1 }, settings: { theme: 'light' } }, // Settings changed
  { user: { id: 2 }, settings: { theme: 'light' } }, // User changed
  { user: { id: 2 }, settings: { theme: 'light' } }  // Same content
]);

const meaningfulChanges = await toArray(
  pipe(
    complexObjects,
    distinctUntilChanged((prev, curr) =>
      prev.user.id === curr.user.id && 
      prev.settings.theme === curr.settings.theme
    )
  )
);
// Only emit when user ID or theme changes
```

### Stream of Events Deduplication

```typescript
const clickEvents = from([
  { type: 'click', target: 'button1' },
  { type: 'click', target: 'button1' },  // Duplicate click
  { type: 'click', target: 'button2' },
  { type: 'hover', target: 'button2' },  // Different event type
  { type: 'hover', target: 'button2' }   // Duplicate hover
]);

const uniqueEvents = await toArray(
  pipe(
    clickEvents,
    distinctUntilChanged((prev, curr) =>
      prev.type === curr.type && prev.target === curr.target
    )
  )
);
// Filter out consecutive duplicate events
```

## Key Characteristics

- **Consecutive comparison**: Only compares with the immediately previous value
- **First value always emitted**: The initial value is always passed through
- **Memory efficient**: Only stores the previous value, not all seen values
- **Custom comparison**: Supports flexible comparison logic
- **Non-consecutive duplicates allowed**: `[1, 2, 1]` would emit all three values

## Performance Notes

- **Minimal overhead**: Only stores one previous value
- **Streaming friendly**: Works with infinite streams
- **No buffering**: Values are processed as they arrive

## Common Use Cases

- **UI state management**: Prevent unnecessary re-renders
- **Sensor data**: Filter out noise in continuous readings
- **User input**: Debounce repeated inputs or selections
- **Database queries**: Avoid redundant queries for same parameters
- **Animation**: Smooth out choppy or redundant state changes
- **Network requests**: Prevent duplicate API calls

## See Also

- [`distinct`](./distinct.md) - Remove all duplicates (not just consecutive)
- [`distinctUntilKeyChanged`](./distinctUntilKeyChanged.md) - Compare by object property
- [`filter`](./filter.md) - General value filtering
- [`debounceTime`](./debounceTime.md) - Time-based deduplication