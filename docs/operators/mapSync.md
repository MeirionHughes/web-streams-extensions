# mapSync

Maps each value in a stream through a synchronous selector function. Optimized for synchronous transformations that don't return promises. Values where the selector returns undefined are filtered out.

## Type Signature

```typescript
interface MapSyncSelector<T, R> {
  (chunk: T, index: number): R | undefined;
}

function mapSync<T, R = T>(
  select: MapSyncSelector<T, R>
): (src: ReadableStream<T>, strategy?: QueuingStrategy<R>) => ReadableStream<R>
```

## Parameters

- `select`: A synchronous function that transforms each chunk. Receives the current value and its index. Must not return a promise.

## Examples

### Basic Synchronous Transformation

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    mapSync(x => x * 2)
  )
);
// Input:  1---2---3---4---|
// Output: 2---4---6---8---|
// Result: [2, 4, 6, 8]
```

### Filtering with undefined

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4, 5]),
    mapSync(x => x % 2 === 0 ? x * 2 : undefined)
  )
);
// Input:  1---2---3---4---5---|
// Output: ----4-------8-------|
// Result: [4, 8]
```

### Type Transformation

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3]),
    mapSync(x => x.toString())
  )
);
// Input:  1-----2-----3-----|
// Output: "1"---"2"---"3"---|
// Result: ['1', '2', '3']
```

### Using Index Parameter

```typescript
const result = await toArray(
  pipe(
    from(['a', 'b', 'c']),
    mapSync((value, index) => `${index}: ${value}`)
  )
);
// Input:  a-----b-----c-----|
// Output: 0:a---1:b---2:c---|
// Result: ['0: a', '1: b', '2: c']
```

### Explicit Promise Mapping

Unlike `map`, `mapSync` can explicitly map to Promise objects without awaiting them:

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3]),
    mapSync(x => Promise.resolve(x * 2))
  )
);
// Input:  1--------2--------3--------|
// Output: Promise--Promise--Promise--|
// Result: [Promise<2>, Promise<4>, Promise<6>]
```

## Performance Notes

- **Faster than `map`**: Optimized for synchronous operations with no promise handling overhead
- **No async support**: Cannot handle async transformations - use `map` for those
- **Better for hot paths**: Ideal for high-frequency, simple transformations

## See Also

- [`map`](./map.md) - Async-capable version with promise support
- [`filter`](./filter.md) - Filter values with a predicate
- [`tap`](./tap.md) - Observe values without transformation