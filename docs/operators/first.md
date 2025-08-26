# first

Emits only the first value from the source stream that matches an optional predicate, then completes. If no predicate is provided, emits the first value encountered.

## Type Signature

```typescript
function first<T>(
  selector?: (value: T) => boolean
): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T>
```

## Parameters

- `selector` *(optional)*: Predicate function to test values. If omitted, defaults to a function that returns `true` for all values (takes the first value).

## Examples

### First Value Without Predicate

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4, 5]),
    first()
  )
);
// Input:  1---2---3---4---5---|
// Output: 1---|
// Result: [1]
```

### First Even Number

```typescript
const result = await toArray(
  pipe(
    from([1, 3, 2, 4, 5]),
    first(x => x % 2 === 0)
  )
);
// Input:  1---3---2---4---5---|
// Test:   F---F---T (predicate results)
// Output:         2---|
// Result: [2]
```

### First String Starting with 'B'

```typescript
const result = await toArray(
  pipe(
    from(['apple', 'banana', 'cherry', 'blueberry']),
    first(s => s.startsWith('b'))
  )
);
// Input:  'apple'---'banana'---'cherry'---'blueberry'---|
// Test:   F---------T (predicate results)
// Output:           'banana'---|
// Result: ['banana']
```

### First Valid User

```typescript
const users = from([
  { name: '', valid: false },
  { name: 'guest', valid: false },
  { name: 'admin', valid: true },
  { name: 'user', valid: true }
]);

const result = await toArray(
  pipe(
    users,
    first(user => user.valid)
  )
);
// Result: [{ name: 'admin', valid: true }]
```

### First Available Item

```typescript
const inventory = from([
  { item: 'laptop', available: false },
  { item: 'mouse', available: false },
  { item: 'keyboard', available: true },
  { item: 'monitor', available: true }
]);

const result = await toArray(
  pipe(
    inventory,
    first(item => item.available)
  )
);
// Result: [{ item: 'keyboard', available: true }]
```

### First High Score

```typescript
const scores = from([45, 67, 89, 92, 78, 95]);

const result = await toArray(
  pipe(
    scores,
    first(score => score > 90)
  )
);
// Input:  45---67---89---92---78---95---|
// Test:   F----F----F----T (predicate results)
// Output:                92---|
// Result: [92]
```

### First Successful Response

```typescript
const responses = from([
  { status: 404, success: false },
  { status: 500, success: false },
  { status: 200, success: true },
  { status: 200, success: true }
]);

const result = await toArray(
  pipe(
    responses,
    first(response => response.success)
  )
);
// Result: [{ status: 200, success: true }]
```

### First Temperature Above Threshold

```typescript
const temperatures = interval(100).pipe(
  map(() => Math.random() * 40 + 10), // Random temp between 10-50°C
  take(20)
);

const result = await toArray(
  pipe(
    temperatures,
    first(temp => temp > 35)
  )
);
// Returns first temperature reading above 35°C
// Result: [temperature] (single value)
```

### First Match in Search

```typescript
const searchResults = from([
  { title: 'Introduction to JavaScript', relevance: 0.3 },
  { title: 'Advanced React Patterns', relevance: 0.6 },
  { title: 'Complete React Guide', relevance: 0.9 },
  { title: 'React Best Practices', relevance: 0.8 }
]);

const result = await toArray(
  pipe(
    searchResults,
    first(result => result.relevance > 0.8)
  )
);
// Result: [{ title: 'Complete React Guide', relevance: 0.9 }]
```

### First Prime Number

```typescript
function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i <= Math.sqrt(n); i++) {
    if (n % i === 0) return false;
  }
  return true;
}

const result = await toArray(
  pipe(
    range(10, 30), // Numbers from 10 to 29
    first(isPrime)
  )
);
// Result: [11] (first prime number >= 10)
```

### First File with Extension

```typescript
const files = from([
  'readme.txt',
  'config.ini', 
  'app.js',
  'styles.css',
  'main.js'
]);

const result = await toArray(
  pipe(
    files,
    first(filename => filename.endsWith('.js'))
  )
);
// Result: ['app.js']
```

### First Element Above Array Average

```typescript
const numbers = [2, 4, 6, 8, 10, 12];
const average = numbers.reduce((a, b) => a + b) / numbers.length;

const result = await toArray(
  pipe(
    from(numbers),
    first(num => num > average)
  )
);
// Average is 7, so first number > 7 is 8
// Result: [8]
```

### First Non-Empty String

```typescript
const result = await toArray(
  pipe(
    from(['', '  ', '\t', 'hello', 'world']),
    first(s => s.trim() !== '')
  )
);
// Result: ['hello']
```

### Empty Stream Handling

```typescript
const result = await toArray(
  pipe(
    from([]),
    first()
  )
);
// Input:  |
// Output: |
// Result: [] (empty array, stream completes immediately)
```

### No Matching Values

```typescript
const result = await toArray(
  pipe(
    from([1, 3, 5, 7]),
    first(x => x % 2 === 0) // Looking for even numbers
  )
);
// Input:  1---3---5---7---|
// Test:   F---F---F---F (no matches)
// Output:                |
// Result: [] (no values match predicate)
```

### First in Infinite Stream

```typescript
const result = await toArray(
  pipe(
    interval(100), // Infinite stream
    first(x => x > 5)
  )
);
// Input:  0---1---2---3---4---5---6---...
// Test:   F---F---F---F---F---F---T
// Output:                         6---|
// Result: [6] (stream cancels after first match)
```

### Error Handling

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    first(x => {
      if (x === 3) throw new Error('Predicate error');
      return x > 2;
    }),
    catchError(err => from(['error-handled']))
  )
);
// Error in predicate propagates through the stream
```

### First with Complex Objects

```typescript
const products = from([
  { name: 'Phone', price: 999, inStock: false },
  { name: 'Laptop', price: 1299, inStock: false },
  { name: 'Tablet', price: 599, inStock: true },
  { name: 'Watch', price: 399, inStock: true }
]);

const result = await toArray(
  pipe(
    products,
    first(product => product.inStock && product.price < 700)
  )
);
// Result: [{ name: 'Tablet', price: 599, inStock: true }]
```

### First After Transformation

```typescript
const result = await toArray(
  pipe(
    from(['1', '2', '3', '4', '5']),
    map(x => parseInt(x)),
    first(x => x > 3)
  )
);
// Transforms strings to numbers, then finds first > 3
// Result: [4]
```

## Key Characteristics

- **Early termination**: Cancels source stream after finding first match
- **Single emission**: Emits at most one value, then completes
- **Memory efficient**: Stops processing as soon as match is found
- **Predicate optional**: Defaults to accepting any value if no predicate provided
- **Completion guarantee**: Always completes, even if no match found

## Common Use Cases

- **Find first match**: Get the first item meeting specific criteria
- **Short-circuit operations**: Stop processing as soon as condition is met
- **Default selection**: Pick the first available option
- **Search operations**: Find first search result above threshold
- **Validation**: Get first valid item from a sequence
- **Performance optimization**: Avoid processing unnecessary data

## See Also

- [`last`](./last.md) - Get the last matching value
- [`take`](./take.md) - Take first N values
- [`find`](../utils.md#find) - Alias for first in some contexts
- [`filter`](./filter.md) - Get all matching values