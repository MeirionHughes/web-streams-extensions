# filter

Filters values in a stream based on a predicate function. Only values that pass the predicate test are emitted by the resulting stream.

## Type Signature

```typescript
// Type guard version
function filter<T, S extends T>(
  predicate: (chunk: T) => chunk is S
): (src: ReadableStream<T>, strategy?: QueuingStrategy<S>) => ReadableStream<S>

// Boolean predicate version
function filter<T>(
  predicate: (chunk: T) => boolean
): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T>
```

## Parameters

- `predicate`: A function that tests each value. Returns `true` to keep the value, `false` to filter it out.

## Examples

### Basic Filtering

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4, 5, 6]),
    filter(x => x % 2 === 0)
  )
);
// Input:  1---2---3---4---5---6---|
// Output: ----2-------4-------6---|
// Result: [2, 4, 6]
```

### String Filtering

```typescript
const result = await toArray(
  pipe(
    from(['apple', 'banana', 'cherry', 'apricot']),
    filter(fruit => fruit.startsWith('a'))
  )
);
// Input:  apple---banana---cherry---apricot---|
// Output: apple-------------------apricot---|
// Result: ['apple', 'apricot']
```

### Type Guard Filtering

```typescript
const items = [1, 'hello', 2, 'world', 3];
const result = await toArray(
  pipe(
    from(items),
    filter((x): x is number => typeof x === 'number')
  )
);
// Input:  1---"hello"---2---"world"---3---|
// Output: 1-------------2-------------3---|
// Result: [1, 2, 3] (typed as number[])
```

### Object Property Filtering

```typescript
const users = [
  { name: 'Alice', active: true },
  { name: 'Bob', active: false },
  { name: 'Charlie', active: true }
];

const result = await toArray(
  pipe(
    from(users),
    filter(user => user.active)
  )
);
// Input:  {Alice,true}---{Bob,false}---{Charlie,true}---|
// Output: {Alice,true}-------------------{Charlie,true}---|
// Result: [{ name: 'Alice', active: true }, { name: 'Charlie', active: true }]
```

### Filtering Null/Undefined

```typescript
const result = await toArray(
  pipe(
    from([1, null, 2, undefined, 3]),
    filter((x): x is number => x != null)
  )
);
// Input:  1---null---2---undefined---3---|
// Output: 1----------2---------------3---|
// Result: [1, 2, 3] (typed as number[])
```

### Range Filtering

```typescript
const result = await toArray(
  pipe(
    from([1, 5, 10, 15, 20, 25]),
    filter(x => x >= 10 && x <= 20)
  )
);
// Input:  1---5---10---15---20---25---|
// Output: --------10---15---20-------|
// Result: [10, 15, 20]
```

### Complex Predicate

```typescript
const products = [
  { name: 'Laptop', price: 1000, inStock: true },
  { name: 'Mouse', price: 25, inStock: false },
  { name: 'Keyboard', price: 75, inStock: true },
  { name: 'Monitor', price: 300, inStock: true }
];

const result = await toArray(
  pipe(
    from(products),
    filter(product => product.price < 500 && product.inStock)
  )
);
// Input:  Laptop---Mouse---Keyboard---Monitor---|
// Output: -----------------Keyboard---Monitor---|
// Result: [{ name: 'Keyboard', price: 75, inStock: true }, { name: 'Monitor', price: 300, inStock: true }]
```

## Performance Notes

- **Synchronous**: Built on top of `mapSync` for optimal performance
- **No emission overhead**: Filtered values are completely skipped, not just marked
- **Type safety**: Type guard predicates provide compile-time type narrowing

## See Also

- [`map`](./map.md) - Transform values
- [`take`](./take.md) - Take first N values
- [`skip`](./skip.md) - Skip first N values
- [`distinctUntilChanged`](./distinctUntilChanged.md) - Filter consecutive duplicates