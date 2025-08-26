# through

Pipes a stream through a standard Web Streams `TransformStream`, allowing integration of native transform streams in operator pipelines.

## Type Signature

```typescript
function through<T, R = T>(dst: TransformStream<T, R>): (
  src: ReadableStream<T>, 
  strategy?: QueuingStrategy<R>
) => ReadableStream<R>
```

## Parameters

- `dst`: A `TransformStream` to pipe the source stream through
- `strategy`: Optional queuing strategy for the output stream

## How It Works

The operator:
1. **Native integration**: Uses standard Web Streams `TransformStream`
2. **Pipes through**: Connects source → transform → output
3. **Type preservation**: Maintains type safety for input and output types
4. **Standard compliance**: Full Web Streams API compatibility

## Examples

### Basic TransformStream Usage

```typescript
const upperCaseTransform = new TransformStream({
  transform(chunk, controller) {
    controller.enqueue(chunk.toUpperCase());
  }
});

const result = await toArray(
  pipe(
    from(['hello', 'world', 'javascript']),
    through(upperCaseTransform)
  )
);
// Result: ['HELLO', 'WORLD', 'JAVASCRIPT']
```

### JSON Processing

```typescript
const jsonParseTransform = new TransformStream({
  transform(chunk, controller) {
    try {
      const parsed = JSON.parse(chunk);
      controller.enqueue(parsed);
    } catch (error) {
      controller.error(error);
    }
  }
});

const jsonStrings = from([
  '{"name": "Alice", "age": 30}',
  '{"name": "Bob", "age": 25}',
  '{"name": "Charlie", "age": 35}'
]);

const parsed = pipe(
  jsonStrings,
  through(jsonParseTransform)
);
// Outputs parsed objects
```

### Text Processing

```typescript
const textCleanupTransform = new TransformStream({
  transform(chunk, controller) {
    const cleaned = chunk
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
    
    if (cleaned) {
      controller.enqueue(cleaned);
    }
    // Skip empty chunks by not enqueuing
  }
});

const messyText = from([
  '  HELLO  WORLD  ',
  '   ',
  'JavaScript    Streams   ',
  ''
]);

const cleaned = pipe(
  messyText,
  through(textCleanupTransform)
);
// Result: ['hello world', 'javascript streams']
```

### Compression Example

```typescript
// Using hypothetical compression transform
const compressionTransform = new CompressionStream('gzip');

const compressedData = pipe(
  from(['large text data', 'more text data', 'even more data']),
  through(compressionTransform)
);

// Data is compressed using native Web Streams compression
```

### CSV Processing

```typescript
const csvRowTransform = new TransformStream({
  start(controller) {
    this.buffer = '';
  },
  
  transform(chunk, controller) {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop(); // Keep incomplete line
    
    for (const line of lines) {
      if (line.trim()) {
        const row = line.split(',').map(cell => cell.trim());
        controller.enqueue(row);
      }
    }
  },
  
  flush(controller) {
    if (this.buffer.trim()) {
      const row = this.buffer.split(',').map(cell => cell.trim());
      controller.enqueue(row);
    }
  }
});

const csvData = from([
  'name,age,city\n',
  'Alice,30,New York\n',
  'Bob,25,Los Angeles\n',
  'Charlie,35,Chicago'
]);

const rows = pipe(
  csvData,
  through(csvRowTransform)
);
// Result: [['name', 'age', 'city'], ['Alice', '30', 'New York'], ...]
```

### Error Handling

```typescript
const errorHandlingTransform = new TransformStream({
  transform(chunk, controller) {
    try {
      const result = riskyOperation(chunk);
      controller.enqueue(result);
    } catch (error) {
      // Transform errors into special error objects
      controller.enqueue({
        error: true,
        message: error.message,
        originalValue: chunk
      });
    }
  }
});

const risky = pipe(
  from([1, 'invalid', 3, null, 5]),
  through(errorHandlingTransform)
);
// Handles errors gracefully within the transform
```

### Batch Processing

```typescript
const batchTransform = new TransformStream({
  start(controller) {
    this.batch = [];
    this.batchSize = 3;
  },
  
  transform(chunk, controller) {
    this.batch.push(chunk);
    
    if (this.batch.length >= this.batchSize) {
      controller.enqueue([...this.batch]);
      this.batch = [];
    }
  },
  
  flush(controller) {
    if (this.batch.length > 0) {
      controller.enqueue([...this.batch]);
    }
  }
});

const batched = pipe(
  from([1, 2, 3, 4, 5, 6, 7, 8]),
  through(batchTransform)
);
// Result: [[1, 2, 3], [4, 5, 6], [7, 8]]
```

### Custom Encoding

```typescript
const base64EncodeTransform = new TransformStream({
  transform(chunk, controller) {
    const encoded = btoa(chunk); // Browser base64 encoding
    controller.enqueue(encoded);
  }
});

const encoded = pipe(
  from(['hello', 'world', 'transform']),
  through(base64EncodeTransform)
);
// Outputs base64 encoded strings
```

## Key Characteristics

- **Native compatibility**: Uses standard Web Streams `TransformStream`
- **Type safety**: Preserves TypeScript types through transformation
- **Standard semantics**: Full Web Streams API behavior
- **Error propagation**: Errors flow through normally
- **Backpressure**: Respects Web Streams backpressure mechanisms

## Use Cases

- **Legacy integration**: Use existing `TransformStream` implementations
- **Standard compliance**: Leverage native Web Streams features
- **Third-party libraries**: Integrate libraries that provide `TransformStream`s
- **Custom transforms**: Create complex transformations with full control
- **Native features**: Use browser APIs like compression, encoding, etc.
- **Performance**: Leverage optimized native implementations

## Comparison with Related Operators

- **`through`**: Uses native `TransformStream`
- **`map`**: Simple value transformation with functions
- **`pipe`**: Chains multiple operators together
- **`toTransform`**: Converts operators to `TransformStream`s

## See Also

- [TransformStream MDN](https://developer.mozilla.org/en-US/docs/Web/API/TransformStream) - Web Streams API documentation
- [`toTransform`](../utilities.md) - Convert operators to TransformStreams
- [`map`](./map.md) - Simple value transformation
- [`pipe`](../piping.md) - Operator chaining