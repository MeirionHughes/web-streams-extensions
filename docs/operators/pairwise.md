# pairwise

Emits the previous and current values from the source stream as pairs (tuples). The first value is buffered, and subsequent values are emitted paired with the previous one.

## Type Signature

```typescript
function pairwise<T>(): (
  src: ReadableStream<T>, 
  strategy?: QueuingStrategy<[T, T]>
) => ReadableStream<[T, T]>
```

## Parameters

- No parameters required
- `strategy`: Optional queuing strategy for backpressure control

## How It Works

The operator:
1. **Buffers first value**: The first value is stored but not emitted
2. **Emits pairs**: Starting with the second value, emits `[previous, current]` tuples
3. **Memory efficient**: Only stores the most recent previous value
4. **Type safe**: Output type is `[T, T]` representing the pair

## Examples

### Basic Pairwise Usage

```typescript
const source = from([1, 2, 3, 4, 5]);

const result = await toArray(
  pipe(
    source,
    pairwise()
  )
);
// Result: [[1, 2], [2, 3], [3, 4], [4, 5]]
```

### Change Detection

```typescript
const values = from([10, 10, 15, 15, 20, 18]);

const changes = pipe(
  values,
  pairwise(),
  filter(([prev, curr]) => prev !== curr),
  map(([prev, curr]) => ({ from: prev, to: curr, delta: curr - prev }))
);

const result = await toArray(changes);
// Result: [
//   { from: 10, to: 15, delta: 5 },
//   { from: 15, to: 20, delta: 5 },
//   { from: 20, to: 18, delta: -2 }
// ]
```

### Trend Analysis

```typescript
const stockPrices = from([100, 102, 98, 105, 103, 108]);

const trends = pipe(
  stockPrices,
  pairwise(),
  map(([prev, curr]) => ({
    price: curr,
    direction: curr > prev ? 'up' : curr < prev ? 'down' : 'stable',
    change: curr - prev
  }))
);

const result = await toArray(trends);
// Result: [
//   { price: 102, direction: 'up', change: 2 },
//   { price: 98, direction: 'down', change: -4 },
//   { price: 105, direction: 'up', change: 7 },
//   { price: 103, direction: 'down', change: -2 },
//   { price: 108, direction: 'up', change: 5 }
// ]
```

### Distance Calculation

```typescript
type Point = { x: number; y: number };

const path = from([
  { x: 0, y: 0 },
  { x: 3, y: 4 },
  { x: 6, y: 8 },
  { x: 9, y: 12 }
]);

const distances = pipe(
  path,
  pairwise(),
  map(([from, to]) => ({
    from,
    to,
    distance: Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2)
  }))
);

const result = await toArray(distances);
// Calculates distance between consecutive points
```

### Rate of Change

```typescript
const temperatures = from([20, 22, 25, 23, 21, 19]);

const rateOfChange = pipe(
  temperatures,
  pairwise(),
  map(([prev, curr], index) => ({
    time: index + 1,
    temperature: curr,
    rate: curr - prev,
    trend: curr > prev ? '🔺' : curr < prev ? '🔻' : '➡️'
  }))
);

const result = await toArray(rateOfChange);
// Tracks temperature changes over time
```

### Validation with Previous Value

```typescript
const userInputs = from(['a', 'ab', 'abc', 'ab', 'abc', 'abcd']);

const validInputs = pipe(
  userInputs,
  pairwise(),
  filter(([prev, curr]) => curr.length > prev.length), // Only growing inputs
  map(([prev, curr]) => curr)
);

const result = await toArray(validInputs);
// Result: ['ab', 'abc', 'abcd'] - only inputs that grew
```

### Single Value Streams

```typescript
const singleValue = from([42]);

const result = await toArray(
  pipe(
    singleValue,
    pairwise()
  )
);
// Result: [] - no pairs possible with single value
```

### Empty Streams

```typescript
const empty = from([]);

const result = await toArray(
  pipe(
    empty,
    pairwise()
  )
);
// Result: [] - no values to pair
```

## Key Characteristics

- **Requires two values**: At least two values needed to emit first pair
- **Memory efficient**: Only stores one previous value
- **Order preserving**: Maintains temporal relationship between values
- **Type safe**: Strong typing for tuple output
- **Stateful**: Remembers previous value across emissions

## Use Cases

- **Change detection**: Identify when values change
- **Trend analysis**: Calculate differences or rates of change
- **Validation**: Compare current value with previous for validation
- **Animation**: Calculate movement between frames
- **Data analysis**: Analyze sequential relationships in data
- **State transitions**: Track state changes over time

## Comparison with Related Operators

- **`pairwise`**: Emits pairs of consecutive values
- **`scan`**: Accumulates values with custom logic
- **`buffer(2)`**: Buffers values but different emission pattern
- **`distinctUntilChanged`**: Filters based on change but doesn't emit pairs

## See Also

- [`scan`](./scan.md) - Accumulate values with custom logic
- [`distinctUntilChanged`](./distinctUntilChanged.md) - Filter consecutive duplicates
- [`buffer`](./buffer.md) - Buffer values into arrays
- [`map`](./map.md) - Transform values