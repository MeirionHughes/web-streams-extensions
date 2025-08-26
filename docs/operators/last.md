# last

Emits only the last value from the source stream that matches an optional predicate. The source stream must complete for the last value to be determined and emitted.

## Type Signature

```typescript
function last<T>(
  selector?: (value: T) => boolean
): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T>
```

## Parameters

- `selector` *(optional)*: Predicate function to test values. If omitted, defaults to a function that returns `true` for all values (returns the last value).

## Examples

### Last Value Without Predicate

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4, 5]),
    last()
  )
);
// Input:  1---2---3---4---5---|
// Output:                   5---|
// Result: [5]
```

### Last Even Number

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4, 5, 6, 7]),
    last(x => x % 2 === 0)
  )
);
// Input:  1---2---3---4---5---6---7---|
// Test:   F---T---F---T---F---T---F (predicate results)
// Output:                         6---|
// Result: [6] (last even number)
```

### Last String Starting with 'C'

```typescript
const result = await toArray(
  pipe(
    from(['apple', 'cherry', 'banana', 'coconut', 'date']),
    last(s => s.startsWith('c'))
  )
);
// Input:  'apple'---'cherry'---'banana'---'coconut'---'date'---|
// Test:   F---------T---------F----------T----------F (predicate results)
// Output:                                            'coconut'---|
// Result: ['coconut']
```

### Last Valid User

```typescript
const users = from([
  { name: 'admin', valid: true },
  { name: 'guest', valid: false },
  { name: 'user1', valid: true },
  { name: 'user2', valid: false },
  { name: 'user3', valid: true }
]);

const result = await toArray(
  pipe(
    users,
    last(user => user.valid)
  )
);
// Result: [{ name: 'user3', valid: true }]
```

### Last High Score

```typescript
const scores = from([45, 92, 67, 89, 78, 95, 82]);

const result = await toArray(
  pipe(
    scores,
    last(score => score > 90)
  )
);
// Input:  45---92---67---89---78---95---82---|
// Test:   F----T----F----F----F----T----F (predicate results)
// Output:                              95---|
// Result: [95] (last score > 90)
```

### Last Successful Response

```typescript
const responses = from([
  { status: 200, success: true },
  { status: 404, success: false },
  { status: 200, success: true },
  { status: 500, success: false },
  { status: 200, success: true }
]);

const result = await toArray(
  pipe(
    responses,
    last(response => response.success)
  )
);
// Result: [{ status: 200, success: true }] (last successful response)
```

### Last Item in Stock

```typescript
const inventory = from([
  { item: 'laptop', inStock: true },
  { item: 'mouse', inStock: false },
  { item: 'keyboard', inStock: true },
  { item: 'monitor', inStock: false },
  { item: 'tablet', inStock: true }
]);

const result = await toArray(
  pipe(
    inventory,
    last(item => item.inStock)
  )
);
// Result: [{ item: 'tablet', inStock: true }]
```

### Last Modified File

```typescript
const files = from([
  { name: 'config.json', modified: new Date('2023-01-01') },
  { name: 'app.js', modified: new Date('2023-06-15') },
  { name: 'readme.md', modified: new Date('2023-03-10') },
  { name: 'package.json', modified: new Date('2023-08-20') }
]);

const cutoffDate = new Date('2023-05-01');

const result = await toArray(
  pipe(
    files,
    last(file => file.modified > cutoffDate)
  )
);
// Result: [{ name: 'package.json', modified: ... }] (last modified after cutoff)
```

### Last Temperature Above Threshold

```typescript
const temperatures = from([22.5, 18.3, 25.7, 19.1, 26.2, 20.8, 24.9]);

const result = await toArray(
  pipe(
    temperatures,
    last(temp => temp > 25)
  )
);
// Result: [26.2] (last temperature above 25°C)
```

### Last Matching Pattern

```typescript
const codes = from(['A123', 'B456', 'A789', 'C012', 'A345']);

const result = await toArray(
  pipe(
    codes,
    last(code => code.startsWith('A'))
  )
);
// Result: ['A345'] (last code starting with 'A')
```

### Last Element in Range

```typescript
const result = await toArray(
  pipe(
    range(1, 20), // Numbers 1 to 19
    last(x => x > 10 && x < 15)
  )
);
// Range includes: 11, 12, 13, 14
// Result: [14] (last number in range 10-15)
```

### Last Non-Empty String

```typescript
const result = await toArray(
  pipe(
    from(['hello', '', 'world', '  ', 'test', '']),
    last(s => s.trim() !== '')
  )
);
// Result: ['test'] (last non-empty string)
```

### Last Character Before Delimiter

```typescript
const characters = from(['a', 'b', 'c', '|', 'd', 'e', 'f']);

const result = await toArray(
  pipe(
    characters,
    last(char => char !== '|')
  )
);
// Result: ['f'] (last character that's not the delimiter)
```

### Last Affordable Item

```typescript
const products = from([
  { name: 'Phone', price: 999 },
  { name: 'Case', price: 25 },
  { name: 'Laptop', price: 1299 },
  { name: 'Mouse', price: 45 },
  { name: 'Keyboard', price: 89 }
]);

const budget = 100;

const result = await toArray(
  pipe(
    products,
    last(product => product.price <= budget)
  )
);
// Result: [{ name: 'Keyboard', price: 89 }] (last affordable item)
```

### Last Valid Date

```typescript
const dateStrings = from(['2023-01-01', 'invalid-date', '2023-06-15', '', '2023-12-31']);

function isValidDate(dateStr: string): boolean {
  return dateStr !== '' && !isNaN(Date.parse(dateStr));
}

const result = await toArray(
  pipe(
    dateStrings,
    last(isValidDate)
  )
);
// Result: ['2023-12-31'] (last valid date string)
```

### Last Error Before Success

```typescript
const attempts = from([
  { attempt: 1, success: false, error: 'timeout' },
  { attempt: 2, success: false, error: 'network' },
  { attempt: 3, success: false, error: 'auth' },
  { attempt: 4, success: true, error: null },
  { attempt: 5, success: true, error: null }
]);

const result = await toArray(
  pipe(
    attempts,
    last(attempt => !attempt.success)
  )
);
// Result: [{ attempt: 3, success: false, error: 'auth' }] (last failed attempt)
```

### Empty Stream Handling

```typescript
const result = await toArray(
  pipe(
    from([]),
    last()
  )
);
// Input:  |
// Output: |
// Result: [] (empty array, no last value to emit)
```

### No Matching Values

```typescript
const result = await toArray(
  pipe(
    from([1, 3, 5, 7]),
    last(x => x % 2 === 0) // Looking for even numbers
  )
);
// Input:  1---3---5---7---|
// Test:   F---F---F---F (no matches)
// Output:                |
// Result: [] (no values match predicate)
```

### Must Wait for Completion

```typescript
// This will not work with infinite streams
const infiniteStream = interval(100); // Never completes

// last() requires stream completion to emit the final value
// Use with take() to make it finite:
const result = await toArray(
  pipe(
    infiniteStream,
    take(10),
    last(x => x > 5)
  )
);
// Result: [9] (last value > 5 from first 10 numbers)
```

### Error Handling

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    last(x => {
      if (x === 3) throw new Error('Predicate error');
      return x > 2;
    }),
    catchError(err => from(['error-handled']))
  )
);
// Error in predicate propagates through the stream
```

### Last After Transformation

```typescript
const result = await toArray(
  pipe(
    from(['1', '4', '2', '5', '3']),
    map(x => parseInt(x)),
    last(x => x > 3)
  )
);
// Transforms strings to numbers, then finds last > 3
// Numbers: 1, 4, 2, 5, 3
// > 3: 4, 5
// Result: [5] (last number > 3)
```

### Last with Complex Condition

```typescript
const events = from([
  { type: 'click', target: 'button1', timestamp: 100 },
  { type: 'hover', target: 'div1', timestamp: 200 },
  { type: 'click', target: 'button2', timestamp: 300 },
  { type: 'scroll', target: 'window', timestamp: 400 },
  { type: 'click', target: 'button1', timestamp: 500 }
]);

const result = await toArray(
  pipe(
    events,
    last(event => event.type === 'click' && event.target === 'button1')
  )
);
// Result: [{ type: 'click', target: 'button1', timestamp: 500 }]
```

### Memory Considerations

```typescript
// last() needs to store the last matching value in memory
// For large objects, consider using a reference or ID instead
const largeObjects = from([
  { id: 1, data: new Array(1000000).fill('large') },
  { id: 2, data: new Array(1000000).fill('large') },
  { id: 3, data: new Array(1000000).fill('large') }
]);

const result = await toArray(
  pipe(
    largeObjects,
    map(obj => obj.id), // Extract just the ID
    last(id => id > 1)
  )
);
// Result: [3] (stores only the ID, not the large object)
```

## Key Characteristics

- **Completion required**: Source stream must complete for last value to be emitted
- **Memory overhead**: Stores the last matching value until stream completes
- **Single emission**: Emits at most one value when source completes
- **Predicate optional**: Defaults to accepting any value if no predicate provided
- **Deferred emission**: Value is only emitted after source completion

## Common Use Cases

- **Get final result**: Extract the last matching item from a sequence
- **Latest value**: Get the most recent valid entry
- **Cleanup operations**: Process the final item meeting criteria
- **Audit trails**: Find the last action of a specific type
- **Configuration**: Get the last valid setting or option
- **Data analysis**: Find the most recent measurement above threshold

## See Also

- [`first`](./first.md) - Get the first matching value
- [`takeLast`](../utils.md#takeLast) - Take last N values
- [`skip`](./skip.md) - Skip first N values
- [`filter`](./filter.md) - Get all matching values