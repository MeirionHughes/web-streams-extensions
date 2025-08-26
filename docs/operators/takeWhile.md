# takeWhile

Takes values while the predicate function returns true, then completes the stream. Stops emitting as soon as the predicate returns false for any value.

## Type Signature

```typescript
function takeWhile<T>(
  predicate: (value: T, index: number) => boolean
): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T>
```

## Parameters

- `predicate`: Function that determines whether to continue taking values. Receives the current value and its index.

## Examples

### Basic Condition Testing

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4, 5]),
    takeWhile(x => x < 3)
  )
);
// Input:  1---2---3---4---5---|
// Test:   T---T---F
// Output: 1---2---|
// Result: [1, 2]
```

### Taking While Below Threshold

```typescript
const temperatures = from([18, 22, 25, 28, 32, 35, 30, 28]);

const result = await toArray(
  pipe(
    temperatures,
    takeWhile(temp => temp < 30)
  )
);
// Input:  18--22--25--28--32--35--30--28---|
// Test:   T---T---T---T---F
// Output: 18--22--25--28---|
// Result: [18, 22, 25, 28]
```

### String Processing

```typescript
const words = from(['hello', 'world', '', 'foo', 'bar']);

const result = await toArray(
  pipe(
    words,
    takeWhile(word => word.length > 0)
  )
);
// Input:  hello--world--""--foo--bar---|
// Test:   T------T------F
// Output: hello--world---|
// Result: ['hello', 'world']
```

### Using Index Parameter

```typescript
const result = await toArray(
  pipe(
    from(['a', 'b', 'c', 'd', 'e']),
    takeWhile((value, index) => index < 3)
  )
);
// Input:  a---b---c---d---e---|
// Index:  0---1---2---3---4
// Test:   T---T---T---F
// Output: a---b---c---|
// Result: ['a', 'b', 'c']
```

### Sensor Data Processing

```typescript
const sensorReadings = from([
  { temperature: 20, humidity: 45 },
  { temperature: 25, humidity: 50 },
  { temperature: 30, humidity: 55 },
  { temperature: 35, humidity: 60 }, // Exceeds safe temp
  { temperature: 32, humidity: 58 }
]);

const safeReadings = await toArray(
  pipe(
    sensorReadings,
    takeWhile(reading => reading.temperature < 35)
  )
);
// Takes readings while temperature is below 35°C
// Result: First 3 readings
```

### Stock Price Monitoring

```typescript
const stockPrices = from([100, 105, 110, 95, 98, 85, 90, 88]);

const risingPrices = await toArray(
  pipe(
    stockPrices,
    takeWhile((price, index) => {
      if (index === 0) return true; // Always take first
      return price >= stockPrices[index - 1]; // Take while rising
    })
  )
);
// Takes prices while they're rising
// Note: This example is conceptual - actual implementation would need state
```

### Log Processing

```typescript
const logLines = from([
  'INFO: System started',
  'INFO: User logged in',
  'WARN: High memory usage',
  'ERROR: Database connection failed',
  'INFO: Retrying connection',
  'INFO: Connection restored'
]);

const preErrorLogs = await toArray(
  pipe(
    logLines,
    takeWhile(line => !line.startsWith('ERROR'))
  )
);
// Input:  INFO--INFO--WARN--ERROR--INFO--INFO---|
// Test:   T-----T-----T-----F
// Output: INFO--INFO--WARN---|
// Result: ['INFO: System started', 'INFO: User logged in', 'WARN: High memory usage']
```

### Game Score Tracking

```typescript
const gameScores = from([10, 25, 40, 35, 50, 65, 45, 70]);

const improvingScores = await toArray(
  pipe(
    gameScores,
    takeWhile((score, index) => {
      // Take while score is improving or it's the first score
      return index === 0 || score > gameScores[index - 1];
    })
  )
);
// Conceptual example - tracks improving scores until first decline
```

### Time-based Processing

```typescript
const events = from([
  { time: 100, data: 'A' },
  { time: 200, data: 'B' },
  { time: 300, data: 'C' },
  { time: 150, data: 'D' }, // Out of order timestamp
  { time: 400, data: 'E' }
]);

const orderedEvents = await toArray(
  pipe(
    events,
    takeWhile((event, index) => {
      if (index === 0) return true;
      // Take while timestamps are in order
      return event.time > events[index - 1].time;
    })
  )
);
// Takes events while timestamps are increasing
```

### Array Processing with Condition

```typescript
const numbers = from([2, 4, 6, 8, 7, 10, 12]);

const evenNumbers = await toArray(
  pipe(
    numbers,
    takeWhile(n => n % 2 === 0)
  )
);
// Input:  2---4---6---8---7---10--12---|
// Test:   T---T---T---T---F
// Output: 2---4---6---8---|
// Result: [2, 4, 6, 8]
```

### Complex Object Filtering

```typescript
const users = from([
  { name: 'Alice', age: 25, active: true },
  { name: 'Bob', age: 30, active: true },
  { name: 'Charlie', age: 35, active: true },
  { name: 'David', age: 28, active: false }, // First inactive user
  { name: 'Eve', age: 32, active: true }
]);

const activeUsers = await toArray(
  pipe(
    users,
    takeWhile(user => user.active)
  )
);
// Takes users while they're active
// Result: [Alice, Bob, Charlie]
```

## Key Characteristics

- **Immediate termination**: Stops as soon as predicate returns false
- **Inclusive of failing value**: The value that fails the predicate is not emitted
- **Index tracking**: Predicate receives the index of each value
- **Early completion**: Stream completes when predicate fails, not when source completes

## Common Use Cases

- **Data validation**: Process data until invalid entry found
- **Threshold monitoring**: Monitor values until threshold exceeded
- **Sequence processing**: Take elements while they meet criteria
- **Log analysis**: Process logs until error or specific event
- **Game mechanics**: Continue until certain condition changes
- **Real-time filtering**: Process live data until trigger condition

## See Also

- [`take`](./take.md) - Take a specific number of values
- [`takeUntil`](./takeUntil.md) - Take until another stream emits
- [`filter`](./filter.md) - Filter values throughout the stream
- [`skipWhile`](./skipWhile.md) - Skip values while predicate is true