# throttleTime

Emits a value from the source stream, then ignores subsequent source values for a specified duration, then repeats this process. The operator operates in two states: **window-not-active** (emit values immediately) and **window-active** (ignore values but keep the last one).

## Type Signature

```typescript
interface ThrottleConfig {
  leading?: boolean;  // Emit very first value immediately (default: true)
  trailing?: boolean; // Emit very last stored value when stream ends (default: true)
}

function throttleTime<T>(
  duration: number,
  config?: ThrottleConfig
): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T>
```

## Parameters

- `duration`: Duration in milliseconds for the throttle window
- `config`: Optional configuration object:
  - `leading`: If `true`, emit the very first value of the stream immediately (default: `true`)
  - `trailing`: If `true`, emit the very last stored window value when the stream ends (default: `true`)

## How It Works

The operator has two distinct states:

1. **window-not-active**: Next value is emitted immediately and starts a new throttle window
2. **window-active**: Values are ignored but the current one is stored for potential trailing emission

The `leading` and `trailing` flags have specific, limited effects:
- `leading`: Only affects the **very first** value of the entire stream
- `trailing`: Only affects the **very last** stored value when the stream **ends**

## Examples

### Basic Throttling (Leading Only)

```typescript
// Simulate rapid events every 50ms, throttle to max one per 200ms
const rapidEvents = timer(0, 50); // 0, 1, 2, 3, 4, 5...

const result = await toArray(
  pipe(
    rapidEvents,
    take(10),
    throttleTime(200) // Default: leading=true, trailing=false
  )
);
// Input:  0--1--2--3--4--5--6--7--8--9|
// Window: |-----|-----|-----|-----|-----|
// Output: 0-----2-----4-----6-----8---|
// Result: [0, 2, 4, 8] (values emitted when window not active)
```

### Leading and Trailing

```typescript
const events = timer(0, 100); // Events every 100ms

const result = await toArray(
  pipe(
    events,
    take(8),
    throttleTime(250, { leading: true, trailing: true })
  )
);
// Input:  0-1-2-3-4-5-6-7|
// Window: |-----|-----|--|
// Output: 0----2----5--7|
// Result: [0, 2, 5, 7] (first immediately + values when window not active + last stored at end)
```

### Trailing Only (No Leading)

```typescript
const events = timer(0, 50);

const result = await toArray(
  pipe(
    events,
    take(10),
    throttleTime(200, { leading: false, trailing: true })
  )
);
// Input:  0-1-2-3-4-5-6-7-8-9|
// Window:   |-----|-----|-----|
// Output: -----3-----7-----9|
// Result: [3, 7, 9] (values when window not active + last stored at end)
```

### Neither Leading nor Trailing

```typescript
const events = timer(0, 50);

const result = await toArray(
  pipe(
    events,
    take(10),
    throttleTime(200, { leading: false, trailing: false })
  )
);
// Input:  0-1-2-3-4-5-6-7-8-9|
// Window:   |-----|-----|-----|
// Output: -----3-----7------|
// Result: [3, 7] (values when window not active, ignore first and last stored)
```

### Button Click Rate Limiting

```typescript
const rapidClicks = from(['click1', 'click2', 'click3', 'click4', 'click5']);

const throttledClicks = await toArray(
  pipe(
    rapidClicks,
    throttleTime(1000) // Max one click per second
  )
);
// Only first click processed immediately, others ignored during 1s window
// Result: ['click1'] (subsequent clicks ignored)
```

### Scroll Event Throttling

```typescript
// Simulate scroll events
const scrollEvents = from([
  { scrollY: 0 },
  { scrollY: 10 },
  { scrollY: 25 },
  { scrollY: 40 },
  { scrollY: 55 },
  { scrollY: 70 }
]);

const throttledScroll = await toArray(
  pipe(
    scrollEvents,
    throttleTime(100, { leading: true, trailing: true })
  )
);
// Processes scroll events: first immediately, last when stream ends
// Result: [{ scrollY: 0 }, { scrollY: 70 }] (first + last stored)
```

### API Request Rate Limiting

```typescript
const searchQueries = from(['a', 'ab', 'abc', 'abcd', 'abcde']);

const throttledSearches = pipe(
  searchQueries,
  throttleTime(300, { leading: true, trailing: true }),
  switchMap(query => 
    fetch(`/api/search?q=${query}`)
      .then(r => r.json())
      .then(data => from([data]))
  )
);

// Makes API calls: first query immediately, last query when search ends
// Ensures both initial query and final query are processed
```

### Mouse Move Event Optimization

```typescript
const mouseMoves = from([
  { x: 10, y: 20 },
  { x: 15, y: 25 },
  { x: 20, y: 30 },
  { x: 25, y: 35 },
  { x: 30, y: 40 },
  { x: 35, y: 45 }
]);

const optimizedMoves = await toArray(
  pipe(
    mouseMoves,
    throttleTime(16, { leading: true, trailing: false }) // ~60fps
  )
);
// Limits mouse move processing to ~60fps for smooth animation
// Result: [{ x: 10, y: 20 }] (first move only, others ignored)
```

### Stream Ending During Window

```typescript
const events = from(async function*() {
  yield 1; // t=0: emit immediately (leading=true), start window
  await sleep(10);
  yield 2; // t=10: window active, ignored, stored
  await sleep(10);
  yield 3; // t=20: window active, ignored, overwrites stored
  // Stream ends while window still active (50ms window, only 20ms passed)
}());

const result = await toArray(
  pipe(
    events,
    throttleTime(50, { leading: true, trailing: true })
  )
);
// Result: [1, 3] (first immediately + last stored when stream ends)
```

### Values Arriving Between Windows

```typescript
const events = from(async function*() {
  yield 1; // t=0: very first, leading=false so ignored, stored, start window
  await sleep(60); // t=60: window expires (50ms duration)
  yield 2; // t=60: window not active, emit immediately, start new window
  await sleep(10);
  yield 3; // t=70: window active, ignored, stored
  await sleep(60); // t=130: window expires
  yield 4; // t=130: window not active, emit immediately, start new window
}());

const result = await toArray(
  pipe(
    events,
    throttleTime(50, { leading: false, trailing: true })
  )
);
// Result: [2, 4] (values when window not active, no stored value at end)
```

### Gaming Input Control

```typescript
const rapidInputs = from(['jump', 'jump', 'jump', 'attack', 'attack']);

const controlledInputs = await toArray(
  pipe(
    rapidInputs,
    throttleTime(500) // Limit actions to prevent spam
  )
);
// Prevents action spam in games
// Result: ['jump'] (subsequent inputs ignored during cooldown)
```

### Real-time Data Sampling

```typescript
const sensorData = timer(0, 10); // Data every 10ms

const sampledData = await toArray(
  pipe(
    sensorData,
    take(50),
    throttleTime(100, { leading: true, trailing: false }) // Sample every 100ms
  )
);
// Values emitted when window not active (approximately every 100ms)
// Input:  0-1-2-...-49|
// Sample: 0----10----20----30----40|
// Result: [0, 10, 20, 30, 40] (values emitted when window not active)
```

### Zero Duration (Immediate)

```typescript
const values = from([1, 2, 3, 4, 5]);

const result = await toArray(
  pipe(
    values,
    throttleTime(0, { leading: true, trailing: true })
  )
);
// Zero duration means immediate window expiration
// Result: [1, 2, 3, 4, 5] (all values pass through)
```

### Configuration Behavior Examples

```typescript
// Test all four configurations with same input
const testData = from(async function*() {
  yield 1; // Very first value
  await sleep(10);
  yield 2; // Window active
  await sleep(10);
  yield 3; // Window active, overwrites stored
  await sleep(60); // Window expires
  yield 4; // Window not active, emit immediately
  await sleep(10);
  yield 5; // Window active, stored (last value)
}());

// leading=true, trailing=false (default)
// Result: [1, 4] (first immediately + when window not active)

// leading=true, trailing=true  
// Result: [1, 4, 5] (first immediately + when window not active + last stored)

// leading=false, trailing=true
// Result: [4, 5] (ignore first + when window not active + last stored)

// leading=false, trailing=false
// Result: [4] (ignore first + when window not active + ignore last stored)
```

### Error Handling with Throttling

```typescript
const errorProneOperations = from([1, 2, 3, 4, 5]);

const throttledOps = pipe(
  errorProneOperations,
  throttleTime(1000),
  map(n => {
    if (n === 1) throw new Error('Operation failed');
    return n * 10;
  }),
  catchError(err => from(['error-handled']))
);

const result = await toArray(throttledOps);
// First operation throws error, throttling doesn't prevent error propagation
// Result: ['error-handled']
```

## Key Characteristics

- **Two-state operation**: window-not-active (emit immediately and start window) vs window-active (ignore but store)
- **Limited flag scope**: `leading` only affects very first value, `trailing` only affects stream end
- **Value storage**: Last value during active window is stored for potential trailing emission
- **Immediate emission**: Values arriving when window not active are emitted immediately
- **Memory efficient**: Only stores one value at a time (the last during current window)

## Configuration Behavior

| Leading | Trailing | Meaning |
|---------|----------|---------|
| `true`(default) | `true`(default) | Emit first value immediately, emit last  stored value at stream end |
| `true`  | `false`  | Emit first value immediately, ignore last stored window value |
| `false` | `true` | Ignore first value, emit last stored value at stream end |
| `false` | `false` | Ignore first value, ignore last stored window value |

## Common Use Cases

- **UI event optimization**: Mouse moves, scroll events, resize events
- **API rate limiting**: Prevent excessive requests while ensuring first and last queries
- **Gaming**: Action cooldowns, input rate limiting
- **Real-time data**: Sampling high-frequency sensor data at regular intervals
- **Performance**: Limiting expensive operations like DOM updates
- **User input**: Preventing button spam while preserving user intent

## Comparison with debounceTime

- **`throttleTime`**: Emits immediately when window not active, limits emission frequency
- **`debounceTime`**: Waits for silence before emitting (only after activity stops)

## See Also

- [`debounceTime`](./debounceTime.md) - Wait for silence before emitting
- [`delay`](./delay.md) - Delay all emissions by a fixed amount
- [`distinctUntilChanged`](./distinctUntilChanged.md) - Filter consecutive duplicates