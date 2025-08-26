# map

Maps each value in a stream through a selector function. Values where the selector returns undefined are filtered out.

## Type Signature

```typescript
interface MapSelector<T, R> {
  (chunk: T, index: number): R | Promise<R>
}

function map<T, R = T>(
  select: MapSelector<T, R>
): (src: ReadableStream<T>, strategy?: QueuingStrategy<R>) => ReadableStream<R>
```

## Parameters

- `select`: A function that transforms each chunk. Receives the current value and its index. Can return a promise for async transformations.

## Examples

### Basic Transformation

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    map(x => x * 2)
  )
);
// Input:  1---2---3---4---|
// Output: 2---4---6---8---|
// Result: [2, 4, 6, 8]
```

### Async Transformation

```typescript
const result = await toArray(
  pipe(
    from(['a', 'b', 'c']),
    map(async (x) => {
      await delay(100);
      return x.toUpperCase();
    })
  )
);
// Input:  a---b---c---|
// Output: A---B---C---| (each delayed by 100ms)
// Result: ['A', 'B', 'C']
```

### Filtering with undefined

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4, 5]),
    map(x => x % 2 === 0 ? x * 2 : undefined)
  )
);
// Input:  1---2---3---4---5---|
// Output: ----4-------8-------|
// Result: [4, 8]
```

### Using Index Parameter

```typescript
const result = await toArray(
  pipe(
    from(['a', 'b', 'c']),
    map((value, index) => `${index}: ${value}`)
  )
);
// Input:  a-----b-----c-----|
// Output: 0:a---1:b---2:c---|
// Result: ['0: a', '1: b', '2: c']
```

## See Also

- [`mapSync`](./mapSync.md) - Synchronous-only version for better performance
- [`filter`](./filter.md) - Filter values with a predicate
- [`switchMap`](./switchMap.md) - Map to streams and switch to latest