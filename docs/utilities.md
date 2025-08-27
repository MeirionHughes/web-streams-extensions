# Utilities

This section covers utility functions for working with Web Streams that provide helper functionality or transform streams into native constructs.

## Stream Utilities

### `tee()`

Splits a single stream into multiple identical streams. Each output stream receives the same data from the source stream.


```typescript
import { tee, from, pipe, map, zip, toArray } from 'web-streams-extensions';

// Split a stream into multiple branches for parallel processing
const source = from([1, 2, 3, 4, 5]);
const [branch1, branch2] = tee(source, 2);

// Process each branch differently
const result1 = await toArray(pipe(branch1, map(x => x * 2)));
const result2 = await toArray(pipe(branch2, map(x => x + 10)));

// result1: [2, 4, 6, 8, 10]
// result2: [11, 12, 13, 14, 15]
```

#### Syntax
```typescript
function tee<T>(
  src: ReadableStream<T>,
  count: number,
  options?: TeeOptions<T>
): ReadableStream<T>[]
```

#### Parameters
- `src`: The source ReadableStream to split
- `count`: Number of output streams to create (must be >= 1)
- `options`: Optional configuration object

#### Options
```typescript
interface TeeOptions<T> {
  overflow?: 'block' | 'throw' | 'cancel';
  strategy?: QueuingStrategy<T>;
}
```

- `overflow`: Policy when a branch's buffer overflows:
  - `'block'` (default): Pauses source reading until all branches have capacity
  - `'throw'`: Errors only the overflowing branch, other branches continue normally
  - `'cancel'`: Errors all branches and cancels source when any branch overflows
- `strategy`: Queuing strategy for each branch

#### Advanced Example: Pipeline Branching and Combining
```typescript
// Tee into multiple processing branches, then combine results
const processed = await toArray(
  pipe(
    from([1, 2, 3, 4, 5]),
    (src) => {
      const [branch1, branch2] = tee(src, 2);
      return zip(
        pipe(branch1, map(x => x * 2)),     // Double the values
        pipe(branch2, map(x => x + 10))     // Add 10 to values
      );
    }
  )
);
// Result: [[2,11], [4,12], [6,13], [8,14], [10,15]]
```

#### Overflow Policy Examples
```typescript
// Block policy (default) - pauses source reading when any branch is full
const [blockBranch1, blockBranch2] = tee(source, 2, { 
  overflow: 'block',
  strategy: { highWaterMark: 1 }
});
// Source reading pauses until all branches have capacity

// Throw policy - only errors the overflowing branch
const [throwBranch1, throwBranch2] = tee(source, 2, { 
  overflow: 'throw',
  strategy: { highWaterMark: 1 }
});
// If throwBranch2 overflows, only throwBranch2 errors, throwBranch1 continues

// Cancel policy - errors all branches and cancels source on any overflow
const [cancelBranch1, cancelBranch2] = tee(source, 2, { 
  overflow: 'cancel',
  strategy: { highWaterMark: 1 }
});
// If any branch overflows, all branches error and source is cancelled
```

For more examples and details, see the examples above and the library source code.

## Stream to Transform Conversion

### `toTransform()`

Converts any operator function into a native `TransformStream` class.

```typescript
import { toTransform, map } from 'web-streams-extensions';

// Create a TransformStream class from a map operator
const MapTransform = toTransform(map);

// Use it like a native TransformStream
const stream = new ReadableStream({ /* ... */ });
const mapped = stream.pipeThrough(new MapTransform(x => x * 2));
```

#### Syntax
```typescript
toTransform<I, O, A extends any[]>(
  opFactory: OpFactory<I, O, A>
): { new(...args: [...A, ToTransformOptions<I, O>?]): TransformStream<I, O> }
```

#### Parameters
- `opFactory`: An operator factory function that creates unary operators

#### Returns
A constructor class that extends `TransformStream` and accepts the operator's parameters plus optional streaming options.

#### Options
The resulting TransformStream constructor accepts an optional last parameter for configuration:

```typescript
interface ToTransformOptions<I, O> {
  writableStrategy?: QueuingStrategy<I>;
  readableStrategy?: QueuingStrategy<O>;
}
```

#### Example: Pre-built Transform Classes
The library provides pre-built TransformStream classes for all operators via the `/transformers` export:

```typescript
import { MapTransform, FilterTransform, TakeTransform } from 'web-streams-extensions/transformers';

const pipeline = new ReadableStream({ /* ... */ })
  .pipeThrough(new MapTransform(x => x * 2))
  .pipeThrough(new FilterTransform(x => x > 10))
  .pipeThrough(new TakeTransform(5));
```

All operator TransformStream classes follow the naming pattern `{OperatorName}Transform`.

Available TransformStream classes include:
- All transformation operators: `MapTransform`, `FilterTransform`, `ScanTransform`, etc.
- All timing operators: `DelayTransform`, `DebounceTimeTransform`, `ThrottleTimeTransform`, etc.
- All flattening operators: `MergeMapTransform`, `SwitchMapTransform`, `ConcatMapTransform`, etc.
- All utility operators: `TapTransform`, `CatchErrorTransform`, `TakeTransform`, etc.
