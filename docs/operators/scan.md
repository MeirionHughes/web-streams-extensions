# scan

Applies an accumulator function to each value and emits intermediate results. Like Array.reduce but emits each intermediate accumulated value instead of just the final result.

## Type Signature

```typescript
function scan<T, R = T>(
  accumulator: (acc: R, value: T, index: number) => R | Promise<R>,
  seed?: R
): (src: ReadableStream<T>, strategy?: QueuingStrategy<R>) => ReadableStream<R>
```

## Parameters

- `accumulator`: Function that combines the accumulation with the current value. Can be async.
- `seed`: Initial value for the accumulation. If not provided, the first value becomes the seed.

## Examples

### Basic Accumulation with Seed

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    scan((acc, val) => acc + val, 0)
  )
);
// Input:  1---2---3---4---|
// Acc:    1---3---6---10--|
// Output: 1---3---6---10--|
// Result: [1, 3, 6, 10]
```

### Without Seed (First Value as Initial)

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    scan((acc, val) => acc + val)
  )
);
// Input:  1---2---3---4---|
// Acc:    1---3---6---10--|
// Output: 1---3---6---10--|
// Result: [1, 3, 6, 10]
```

### Building Arrays

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3]),
    scan((acc, val) => [...acc, val], [] as number[])
  )
);
// Input:  1-------2-------3-------|
// Output: [1]-----[1,2]---[1,2,3]-|
// Result: [[1], [1, 2], [1, 2, 3]]
```

### String Concatenation

```typescript
const result = await toArray(
  pipe(
    from(['Hello', ' ', 'World', '!']),
    scan((acc, val) => acc + val, '')
  )
);
// Input:  "Hello"---" "---"World"---"!"---|
// Output: "Hello"---"Hello "---"Hello World"---"Hello World!"|
// Result: ['Hello', 'Hello ', 'Hello World', 'Hello World!']
```

### Async Accumulation

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3]),
    scan(async (acc, val) => {
      await delay(100);
      return acc + val;
    }, 0)
  )
);
// Input:  1---2---3---|
// Output: 1---3---6---| (each emission delayed by 100ms)
// Result: [1, 3, 6]
```

### Using Index Parameter

```typescript
const result = await toArray(
  pipe(
    from(['a', 'b', 'c']),
    scan((acc, val, index) => `${acc},${index}:${val}`, '')
  )
);
// Input:  a-----b-----c-----|
// Output: ,0:a--,0:a,1:b--,0:a,1:b,2:c|
// Result: [',0:a', ',0:a,1:b', ',0:a,1:b,2:c']
```

### Running Maximum

```typescript
const result = await toArray(
  pipe(
    from([3, 1, 4, 1, 5, 9, 2]),
    scan((max, val) => Math.max(max, val))
  )
);
// Input:  3---1---4---1---5---9---2---|
// Output: 3---3---4---4---5---9---9---|
// Result: [3, 3, 4, 4, 5, 9, 9]
```

## See Also

- [`reduce`](./reduce.md) - Emit only the final accumulated result
- [`map`](./map.md) - Transform values without accumulation
- [`buffer`](./buffer.md) - Collect values into arrays