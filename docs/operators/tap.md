# tap

Performs side effects for each value without modifying the stream. Useful for debugging, logging, or triggering side effects without changing the data flow.

## Type Signature

```typescript
function tap<T>(
  cb: (chunk: T, index: number) => void
): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T>
```

## Parameters

- `cb`: Callback function to execute for each value. This should only perform side effects and not return any value.

## Examples

### Basic Logging

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    tap(x => console.log('Processing:', x)),
    map(x => x * 2)
  )
);
// Console output:
// Processing: 1
// Processing: 2  
// Processing: 3
// Processing: 4

// Input:  1---2---3---4---|
// Tap:    1---2---3---4---| (unchanged, but logs each value)
// Map:    2---4---6---8---|
// Result: [2, 4, 6, 8]
```

### Debugging with Index

```typescript
const result = await toArray(
  pipe(
    from(['a', 'b', 'c']),
    tap((value, index) => console.log(`[${index}] ${value}`)),
    map(x => x.toUpperCase())
  )
);
// Console output:
// [0] a
// [1] b
// [2] c

// Result: ['A', 'B', 'C']
```

### State Updates

```typescript
let processed = 0;
const result = await toArray(
  pipe(
    from([1, 2, 3, 4, 5]),
    tap(() => processed++),
    filter(x => x % 2 === 0)
  )
);

console.log(`Processed ${processed} items`); // "Processed 5 items"
// Result: [2, 4]
```

### Progress Tracking

```typescript
const total = 100;
let current = 0;

const result = await toArray(
  pipe(
    range(1, total),
    tap(() => {
      current++;
      if (current % 10 === 0) {
        console.log(`Progress: ${current}/${total}`);
      }
    }),
    filter(x => x % 5 === 0),
    take(5)
  )
);
// Console output:
// Progress: 10/100
// Progress: 20/100
// Progress: 30/100

// Result: [5, 10, 15, 20, 25]
```

### Cache Population

```typescript
const cache = new Map<number, string>();

const result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    map(n => ({ id: n, data: `data-${n}` })),
    tap(item => cache.set(item.id, item.data)), // Populate cache
    map(item => item.id)
  )
);

console.log(cache); // Map { 1 => 'data-1', 2 => 'data-2', 3 => 'data-3', 4 => 'data-4' }
// Result: [1, 2, 3, 4]
```

### Event Triggering

```typescript
const eventEmitter = new EventTarget();

const result = await toArray(
  pipe(
    from(['start', 'processing', 'complete']),
    tap(status => {
      eventEmitter.dispatchEvent(new CustomEvent('status', { detail: status }));
    })
  )
);

// Events are fired for each status
// Result: ['start', 'processing', 'complete']
```

### Conditional Side Effects

```typescript
const errors: string[] = [];

const result = await toArray(
  pipe(
    from([1, -2, 3, -4, 5]),
    tap(x => {
      if (x < 0) {
        errors.push(`Negative value: ${x}`);
      }
    }),
    filter(x => x > 0)
  )
);

console.log(errors); // ['Negative value: -2', 'Negative value: -4']
// Result: [1, 3, 5]
```

### Multiple Taps

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3]),
    tap(x => console.log('Raw:', x)),
    map(x => x * 2),
    tap(x => console.log('Doubled:', x)),
    map(x => x + 1),
    tap(x => console.log('Final:', x))
  )
);
// Console output:
// Raw: 1        Raw: 2        Raw: 3
// Doubled: 2    Doubled: 4    Doubled: 6
// Final: 3      Final: 5      Final: 7

// Result: [3, 5, 7]
```

## Error Handling

If the tap callback throws an error, it's caught and logged to the console, but the stream continues:

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    tap(x => {
      if (x === 2) throw new Error('Tap error');
      console.log('Processed:', x);
    }),
    map(x => x * 2)
  )
);
// Console output:
// Processed: 1
// Error in tap operator: Error: Tap error
// Processed: 3
// Processed: 4

// Result: [2, 4, 6, 8] (stream continues despite tap error)
```

## Performance Notes

- **Zero overhead**: Values pass through unchanged
- **Synchronous**: Built on `mapSync` for optimal performance
- **Error isolation**: Tap errors don't break the stream

## See Also

- [`map`](./map.md) - Transform values
- [`filter`](./filter.md) - Filter values based on predicates
- [`on`](./on.md) - Lifecycle event handling