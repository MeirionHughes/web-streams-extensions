# ignoreElements

Ignores all values from the source stream but preserves completion and error signals. The output stream completes when the source completes and errors when the source errors.

## Type Signature

```typescript
function ignoreElements<T>(): (
  src: ReadableStream<T>, 
  strategy?: QueuingStrategy<never>
) => ReadableStream<never>
```

## Parameters

- No parameters required
- `strategy`: Optional queuing strategy (not used since no values are emitted)

## How It Works

The operator:
1. **Ignores all values**: No values from the source are emitted to the output
2. **Preserves completion**: When source completes, output completes
3. **Preserves errors**: When source errors, output errors with the same error
4. **Side effects only**: Useful for operations that have side effects but don't need to emit values

## Examples

### Basic Usage

```typescript
const source = from([1, 2, 3, 4, 5]);

const result = await toArray(
  pipe(
    source,
    ignoreElements()
  )
);
// Result: [] - no values emitted
```

### With Side Effects

```typescript
const loggedStream = pipe(
  from(['processing', 'data', 'items']),
  tap(value => console.log(`Processing: ${value}`)), // Side effect
  ignoreElements()  // Ignore values but keep side effects
);

await toArray(loggedStream);
// Console output: 
// "Processing: processing"
// "Processing: data" 
// "Processing: items"
// Result: []
```

### Waiting for Completion

```typescript
const heavyProcessing = pipe(
  from(largeDataSet),
  map(item => expensiveOperation(item)),
  tap(result => saveToDatabase(result)),
  ignoreElements()
);

// Wait for all processing to complete without collecting results
await toPromise(heavyProcessing);
console.log('All processing complete');
```

### Error Propagation

```typescript
const errorStream = pipe(
  from([1, 2, 3]),
  map(x => {
    if (x === 2) throw new Error('Processing failed');
    return x;
  }),
  ignoreElements()
);

try {
  await toPromise(errorStream);
} catch (error) {
  console.log(error.message); // "Processing failed"
}
```

### Background Processing

```typescript
const backgroundWork = pipe(
  interval(1000),
  take(5),
  tap(tick => performMaintenanceTask(tick)),
  ignoreElements()
);

// Start background work without blocking
toArray(backgroundWork).then(() => {
  console.log('Background maintenance complete');
});

// Continue with other work immediately
const mainWork = pipe(
  from(mainDataSet),
  map(processMainData)
);
```

### Pipeline Synchronization

```typescript
const setupPhase = pipe(
  from(['init-db', 'load-config', 'start-services']),
  map(task => performSetupTask(task)),
  tap(result => console.log(`Completed: ${result}`)),
  ignoreElements()
);

// Wait for setup before starting main processing
await toPromise(setupPhase);

const mainProcessing = pipe(
  from(workItems),
  map(processWorkItem)
);
```

## Key Characteristics

- **Value suppression**: No values are emitted to output stream
- **Completion preservation**: Completes when source completes
- **Error preservation**: Errors when source errors
- **Side effect friendly**: Perfect for operations with side effects
- **Memory efficient**: No values stored or buffered

## Use Cases

- **Side effect operations**: When you only care about side effects, not values
- **Process synchronization**: Wait for completion without collecting results
- **Background processing**: Run tasks without emitting results
- **Setup/teardown phases**: Execute initialization without returning values
- **Logging/monitoring**: Process streams for monitoring without affecting pipeline
- **Validation**: Check stream processing without keeping results

## Comparison with Related Operators

- **`ignoreElements`**: Ignores all values, preserves completion/error
- **`filter(() => false)`**: Similar but more explicit about filtering
- **`tap`**: Observes values but still emits them
- **`take(0)`**: Completes immediately without processing source

## See Also

- [`tap`](./tap.md) - Observe values without modification
- [`on`](./on.md) - Attach lifecycle callbacks
- [`filter`](./filter.md) - Filter values with predicates
- [`take`](./take.md) - Take specified number of values