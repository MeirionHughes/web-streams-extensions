# reduce

Applies an accumulator function to each value and emits only the final result. Like Array.reduce but for streams - only emits when the source stream completes.

## Type Signature

```typescript
function reduce<T, R = T>(
  accumulator: (acc: R, value: T, index: number) => R | Promise<R>,
  seed: R
): (src: ReadableStream<T>, strategy?: QueuingStrategy<R>) => ReadableStream<R>
```

## Parameters

- `accumulator`: Function that combines the accumulation with the current value. Can be async.
- `seed`: Initial value for the accumulation (required).

## Examples

### Sum Calculation

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    reduce((acc, val) => acc + val, 0)
  )
);
// Input:  1---2---3---4---|
// Acc:    1---3---6---10--X (internal, not emitted)
// Output: ----------------10|
// Result: [10]
```

### Array Concatenation

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    reduce((acc, val) => [...acc, val], [] as number[])
  )
);
// Input:  1---2---3---4---|
// Output: ----------------[1,2,3,4]|
// Result: [[1, 2, 3, 4]]
```

### String Building

```typescript
const result = await toArray(
  pipe(
    from(['H', 'e', 'l', 'l', 'o']),
    reduce((acc, val) => acc + val, '')
  )
);
// Input:  H---e---l---l---o---|
// Output: --------------------"Hello"|
// Result: ['Hello']
```

### Object Construction

```typescript
const result = await toArray(
  pipe(
    from([
      { key: 'a', value: 1 },
      { key: 'b', value: 2 },
      { key: 'c', value: 3 }
    ]),
    reduce(
      (acc, item) => ({ ...acc, [item.key]: item.value }),
      {} as Record<string, number>
    )
  )
);
// Input:  {a:1}---{b:2}---{c:3}---|
// Output: ------------------------{a:1,b:2,c:3}|
// Result: [{ a: 1, b: 2, c: 3 }]
```

### Async Accumulation

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3]),
    reduce(async (acc, val) => {
      await delay(100);
      return acc + val;
    }, 0)
  )
);
// Input:  1---2---3---|
// Output: ------------6| (final result after all async operations)
// Result: [6]
```

### Finding Maximum

```typescript
const result = await toArray(
  pipe(
    from([3, 7, 2, 9, 1]),
    reduce((max, val) => Math.max(max, val), -Infinity)
  )
);
// Input:  3---7---2---9---1---|
// Output: --------------------9|
// Result: [9]
```

### Using Index Parameter

```typescript
const result = await toArray(
  pipe(
    from(['a', 'b', 'c']),
    reduce(
      (acc, val, index) => acc + `${index}:${val},`,
      ''
    )
  )
);
// Input:  a---b---c---|
// Output: ------------"0:a,1:b,2:c,"|
// Result: ['0:a,1:b,2:c,']
```

## Key Differences from `scan`

- **Emission timing**: `reduce` emits only when the source completes, `scan` emits for each input value
- **Use case**: `reduce` for final aggregation, `scan` for intermediate results
- **Memory**: `reduce` uses less memory as it doesn't emit intermediate values

## See Also

- [`scan`](./scan.md) - Emit intermediate accumulated results
- [`toArray`](../consuming.md#toarray) - Collect all values into an array
- [`count`](./count.md) - Count the number of values