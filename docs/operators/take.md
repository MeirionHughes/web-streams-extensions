# take

Takes only the first `count` elements from the source stream. After emitting the specified number of elements, the stream completes and the source is cancelled.

## Type Signature

```typescript
function take<T>(
  count: number
): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T>
```

## Parameters

- `count`: The number of elements to take. Must be non-negative.

## Examples

### Basic Take

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4, 5]),
    take(3)
  )
);
// Input:  1---2---3---4---5---|
// Output: 1---2---3---|
// Result: [1, 2, 3]
```

### Take Zero

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4, 5]),
    take(0)
  )
);
// Input:  1---2---3---4---5---|
// Output: |
// Result: []
```

### Take More Than Available

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3]),
    take(5)
  )
);
// Input:  1---2---3---|
// Output: 1---2---3---|
// Result: [1, 2, 3]
```

### Take One

```typescript
const result = await toArray(
  pipe(
    from(['first', 'second', 'third']),
    take(1)
  )
);
// Input:  first---second---third---|
// Output: first---|
// Result: ['first']
```

### Take with Infinite Stream

```typescript
const result = await toArray(
  pipe(
    interval(100), // Emits 0, 1, 2, 3... every 100ms
    take(4)
  )
);
// Input:  0---1---2---3---4---5---...
// Output: 0---1---2---3---|
// Result: [0, 1, 2, 3]
```

### Take with Async Source

```typescript
const asyncGenerator = async function* () {
  for (let i = 0; i < 10; i++) {
    await delay(50);
    yield i;
  }
};

const result = await toArray(
  pipe(
    from(asyncGenerator()),
    take(3)
  )
);
// Input:  0---1---2---3---4---...
// Output: 0---1---2---|
// Result: [0, 1, 2]
```

### Combining with Other Operators

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    filter(x => x % 2 === 0),
    take(3)
  )
);
// Input:  1---2---3---4---5---6---7---8---9---10---|
// Filter: ----2-------4-------6-------8-------10---|
// Take:   ----2-------4-------6---|
// Result: [2, 4, 6]
```

## Behavior Notes

- **Early termination**: The source stream is cancelled once the count is reached
- **Resource cleanup**: Properly cancels upstream operations to prevent resource leaks
- **Zero count**: Immediately completes without reading from source
- **Negative count**: Throws an error

## See Also

- [`takeWhile`](./takeWhile.md) - Take while a condition is true
- [`takeUntil`](./takeUntil.md) - Take until another stream emits
- [`skip`](./skip.md) - Skip first N values
- [`first`](./first.md) - Take first value matching a predicate