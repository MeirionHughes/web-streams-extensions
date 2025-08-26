# skipWhile

Skips values from the source stream while a predicate function returns true. Once the predicate returns false for any value, that value and all subsequent values are emitted, regardless of whether they would match the predicate.

## Type Signature

```typescript
function skipWhile<T>(
  predicate: (value: T, index: number) => boolean
): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T>
```

## Parameters

- `predicate`: Function that determines whether to skip a value. Receives the current value and its index. Once this returns `false`, all subsequent values are emitted.

## Examples

### Basic Conditional Skip

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 2, 4, 1, 5]),
    skipWhile(x => x < 3)
  )
);
// Input:  1---2---3---2---4---1---5---|
// Test:   T---T---F (predicate results)
// Output:         3---2---4---1---5---|
// Result: [3, 2, 4, 1, 5] (skips initial 1,2 but emits later ones)
```

### Skip Loading States

```typescript
const appStates = from([
  { loading: true, data: null },
  { loading: true, data: null },
  { loading: false, data: [] },
  { loading: false, data: [1, 2, 3] },
  { loading: true, data: [1, 2, 3] } // Loading again, but still emitted
]);

const result = await toArray(
  pipe(
    appStates,
    skipWhile(state => state.loading)
  )
);
// Skips first two loading states, then emits all subsequent states
// Result: [
//   { loading: false, data: [] },
//   { loading: false, data: [1, 2, 3] },
//   { loading: true, data: [1, 2, 3] }
// ]
```

### Skip Negative Numbers

```typescript
const result = await toArray(
  pipe(
    from([-3, -1, 0, 2, -5, 4]),
    skipWhile(x => x < 0)
  )
);
// Input:  -3---(-1)---0---2---(-5)---4---|
// Test:   T----T------F (predicate results)
// Output:             0---2---(-5)---4---|
// Result: [0, 2, -5, 4] (includes later negative number)
```

### Skip Empty Strings

```typescript
const result = await toArray(
  pipe(
    from(['', '  ', 'hello', '', 'world']),
    skipWhile(s => s.trim() === '')
  )
);
// Input:  ''---'  '---'hello'---''---'world'---|
// Test:   T----T-------F (predicate results)
// Output:             'hello'---''---'world'---|
// Result: ['hello', '', 'world'] (includes later empty string)
```

### Skip Until Threshold with Index

```typescript
const result = await toArray(
  pipe(
    from([10, 15, 20, 25, 30]),
    skipWhile((value, index) => index < 2 || value < 25)
  )
);
// Skips first 2 items OR values < 25
// Index: 0----1----2----3----4
// Value: 10---15---20---25---30
// Test:  T----T----T----F (first false at index 3, value 25)
// Output:                25---30---|
// Result: [25, 30]
```

### Skip Warm-up Period

```typescript
const measurements = from([
  { temp: 18.5, stable: false },
  { temp: 19.2, stable: false },
  { temp: 20.1, stable: true },
  { temp: 20.0, stable: true },
  { temp: 19.8, stable: false } // Unstable again, but still emitted
]);

const result = await toArray(
  pipe(
    measurements,
    skipWhile(m => !m.stable)
  )
);
// Skips until first stable reading, then emits all subsequent readings
// Result: [
//   { temp: 20.1, stable: true },
//   { temp: 20.0, stable: true },
//   { temp: 19.8, stable: false }
// ]
```

### Skip Until Valid Data

```typescript
const responses = from([
  { status: 'error', data: null },
  { status: 'pending', data: null },
  { status: 'success', data: [1, 2, 3] },
  { status: 'error', data: null }, // Error after success, still emitted
  { status: 'success', data: [4, 5, 6] }
]);

const result = await toArray(
  pipe(
    responses,
    skipWhile(r => r.status !== 'success')
  )
);
// Skips until first successful response, then emits everything
// Result: [
//   { status: 'success', data: [1, 2, 3] },
//   { status: 'error', data: null },
//   { status: 'success', data: [4, 5, 6] }
// ]
```

### Skip Comments in File Processing

```typescript
const lines = from([
  '# This is a comment',
  '# Another comment',
  'actual.data = value1',
  'more.data = value2',
  '# Comment in middle (still emitted)',
  'final.data = value3'
]);

const result = await toArray(
  pipe(
    lines,
    skipWhile(line => line.startsWith('#'))
  )
);
// Skips initial comments, then processes all lines
// Result: [
//   'actual.data = value1',
//   'more.data = value2', 
//   '# Comment in middle (still emitted)',
//   'final.data = value3'
// ]
```

### Skip Until User Ready

```typescript
const events = from([
  { type: 'system', message: 'Starting up...' },
  { type: 'system', message: 'Loading config...' },
  { type: 'user', message: 'Hello!' },
  { type: 'system', message: 'Auto-save...' },
  { type: 'user', message: 'How are you?' }
]);

const result = await toArray(
  pipe(
    events,
    skipWhile(event => event.type !== 'user')
  )
);
// Skips system messages until first user message
// Result: [
//   { type: 'user', message: 'Hello!' },
//   { type: 'system', message: 'Auto-save...' },
//   { type: 'user', message: 'How are you?' }
// ]
```

### Skip Failed Authentication Attempts

```typescript
const authAttempts = from([
  { attempt: 1, success: false, user: 'guest' },
  { attempt: 2, success: false, user: 'guest' },
  { attempt: 3, success: true, user: 'admin' },
  { attempt: 4, success: false, user: 'admin' }, // Failed after success
  { attempt: 5, success: true, user: 'admin' }
]);

const result = await toArray(
  pipe(
    authAttempts,
    skipWhile(auth => !auth.success)
  )
);
// Skips failed attempts until first success, then tracks all activity
// Result: [
//   { attempt: 3, success: true, user: 'admin' },
//   { attempt: 4, success: false, user: 'admin' },
//   { attempt: 5, success: true, user: 'admin' }
// ]
```

### Skip Initialization Phase

```typescript
const gameStates = interval(100).pipe(
  map(tick => ({
    tick,
    phase: tick < 5 ? 'init' : tick < 10 ? 'loading' : 'playing',
    ready: tick >= 10
  })),
  take(15)
);

const result = await toArray(
  pipe(
    gameStates,
    skipWhile(state => state.phase === 'init')
  )
);
// Skips initialization phase, includes loading and playing phases
// Result: States from loading phase onwards
```

### Skip Buffer Underrun

```typescript
const bufferStates = from([
  { level: 10, underrun: true },
  { level: 25, underrun: true },
  { level: 50, underrun: false },
  { level: 45, underrun: false },
  { level: 20, underrun: true }, // Underrun again, but still emitted
  { level: 60, underrun: false }
]);

const result = await toArray(
  pipe(
    bufferStates,
    skipWhile(state => state.underrun)
  )
);
// Skips while buffer is in underrun, then processes all states
// Result: [
//   { level: 50, underrun: false },
//   { level: 45, underrun: false },
//   { level: 20, underrun: true },
//   { level: 60, underrun: false }
// ]
```

### Skip Until Stable Network

```typescript
const networkStates = from([
  { latency: 500, stable: false },
  { latency: 300, stable: false },
  { latency: 100, stable: true },
  { latency: 120, stable: true },
  { latency: 400, stable: false } // Network becomes unstable again
]);

const result = await toArray(
  pipe(
    networkStates,
    skipWhile(state => !state.stable)
  )
);
// Skips until network stabilizes, then monitors all subsequent states
// Result: [
//   { latency: 100, stable: true },
//   { latency: 120, stable: true },
//   { latency: 400, stable: false }
// ]
```

### Error Handling

```typescript
const values = from([1, 2, 3, 4, 5]);

// Predicate that throws an error
const result = await toArray(
  pipe(
    values,
    skipWhile(x => {
      if (x === 3) throw new Error('Predicate error');
      return x < 3;
    }),
    catchError(err => from(['error-handled']))
  )
);
// Error in predicate stops the stream and triggers error handling
```

## Key Characteristics

- **One-time skip**: Once predicate returns false, it's never called again
- **Index tracking**: Predicate receives both value and index
- **Stateful operation**: Remembers whether it's still in skipping mode
- **Predicate isolation**: Once skipping stops, predicate is no longer evaluated
- **Completion preservation**: Stream completion is preserved

## Common Use Cases

- **Skip initialization**: Skip setup or loading states
- **Skip invalid data**: Skip until valid data appears
- **Skip headers/metadata**: Skip initial non-data content
- **Skip warm-up periods**: Skip unstable initial measurements
- **Skip authentication**: Skip until user is authenticated
- **Skip comments**: Skip initial comments in file processing

## See Also

- [`skip`](./skip.md) - Skip a fixed number of values
- [`takeWhile`](./takeWhile.md) - Take values while condition is true
- [`filter`](./filter.md) - Filter values based on predicate (applied to all values)
- [`dropWhile`](../utils.md#dropWhile) - Alias for skipWhile in some contexts