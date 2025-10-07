# Workers

Support for processing streams in Web Workers for non-blocking operation and parallel processing.

## Overview

The worker utilities allow you to offload stream processing to Web Workers, enabling:
- Non-blocking stream operations in the main thread
- Parallel processing of multiple streams
- CPU-intensive operations without UI blocking
- Proper handling of transferable objects for performance

This document covers the worker-side API (`onStream`). For main thread usage and the `bridge` operator, see **[bridge operator documentation](./operators/bridge.md)**.

## Setup

### In the Worker

Use `onStream` to handle incoming stream requests in your worker:

```typescript
// worker.js
import { onStream } from 'web-streams-extensions/workers';

onStream(({ name, accept, reject }) => {
  if (name === 'process-data') {
    // Accept the stream request and get readable/writable streams
    const { readable, writable } = accept();
    
    // Apply operations using pipe-through transform
    readable
      .pipeThrough(new TransformStream({
        transform(chunk, controller) {
          // CPU-intensive processing
          const processed = heavyComputation(chunk);
          if (processed > 10) { // example threshold
            controller.enqueue(processed);
          }
        }
      }))
      .pipeTo(writable);
  } else {
    reject(`Unknown stream type: ${name}`);
  }
});
```

### In the Main Thread

Send streams to the worker using the `bridge` operator:

```typescript
// main.js
import { bridge } from 'web-streams-extensions';
import { pipe } from 'web-streams-extensions';

const worker = new Worker('./worker.js', { type: 'module' });

// Process a stream in the worker
const processedStream = pipe(
  originalStream,
  bridge(worker, 'process-data')
);
```

For complete `bridge` operator details, options, and examples, see **[bridge operator documentation](./operators/bridge.md)**.

## API Reference

### `onStream(handler, getTransferables?)`

Register a stream handler in a Worker context.

#### Parameters

- `handler: StreamHandler` - Function that processes incoming stream requests
- `getTransferables?: GetTransferablesFn` - Optional Worker-wide function to extract transferable objects

#### StreamHandler Type

```typescript
type StreamHandler = (request: StreamRequest) => void;

interface StreamRequest {
  name: string;
  accept(options?: AcceptOptions): { readable: ReadableStream; writable: WritableStream };
  reject(reason?: any): void;
}

interface AcceptOptions {
  getTransferables?: GetTransferablesFn; // Per-stream transferable extraction
}
```

**Important:** `accept()` and `reject()` are mutually exclusive - you must call one or the other, but never both. Calling `accept()` establishes the bidirectional stream connection. Attempting to call `reject()` after `accept()` (or vice versa) will throw an error.

#### Example: Per-Stream Transferables

```typescript
import { onStream } from 'web-streams-extensions/workers';

onStream(({ name, accept, reject }) => {
  if (name === 'process-buffers') {
    // Register per-stream getTransferables to transfer Uint8Array buffers
    const { readable, writable } = accept({
      getTransferables: (value) => {
        if (value instanceof Uint8Array) {
          return [value.buffer];
        }
        return [];
      }
    });
    
    readable
      .pipeThrough(new TransformStream({
        transform(data, controller) {
          const processed = processBuffer(data);
          controller.enqueue(processed);
        }
      }))
      .pipeTo(writable);
  } else {
    reject(`Unknown stream type: ${name}`);
  }
});
```

## Transferable Objects

For optimal performance with large data objects, specify transferable objects to avoid copying:

### Automatic Detection

The library automatically detects common transferable types:
- `ArrayBuffer`
- `MessagePort`
- `ImageBitmap`
- `OffscreenCanvas`

### Custom Transferables

Provide a custom function to extract transferables:

```typescript
onStream(({ name, accept, reject }) => {
  if (name === 'process-buffers') {
    const { readable, writable } = accept();
    
    readable
      .pipeThrough(new TransformStream({
        transform(data, controller) {
          // Process data with buffers
          controller.enqueue(processBuffer(data));
        }
      }))
      .pipeTo(writable);
  } else {
    reject(`Unknown stream type: ${name}`);
  }
}, (value) => {
  const transferables = [];
  
  if (value.buffer instanceof ArrayBuffer) {
    transferables.push(value.buffer);
  }
  
  if (value.canvas instanceof OffscreenCanvas) {
    transferables.push(value.canvas);
  }
  
  return transferables;
});
```

## Practical Examples

### Multiple Stream Types in One Worker

```typescript
// worker.js
import { onStream } from 'web-streams-extensions/workers';

onStream(({ name, accept, reject }) => {
  const { readable, writable } = accept();
  
  switch (name) {
    case 'double':
      readable
        .pipeThrough(new TransformStream({
          transform(chunk, controller) {
            controller.enqueue(chunk * 2);
          }
        }))
        .pipeTo(writable);
      break;
      
    case 'uppercase':
      readable
        .pipeThrough(new TransformStream({
          transform(chunk, controller) {
            controller.enqueue(chunk.toUpperCase());
          }
        }))
        .pipeTo(writable);
      break;
      
    default:
      reject(`Unknown stream type: ${name}`);
  }
});
```

## Error Handling

Errors thrown in worker transforms are automatically propagated to the main thread:

```typescript
onStream(({ name, accept, reject }) => {
  if (name === 'validate') {
    const { readable, writable } = accept();
    
    readable
      .pipeThrough(new TransformStream({
        transform(data, controller) {
          if (!isValid(data)) {
            throw new Error('Invalid data format'); // Propagates to main thread
          }
          controller.enqueue(processData(data));
        }
      }))
      .pipeTo(writable);
  } else {
    reject(`Unknown stream type: ${name}`); // Also propagates to main thread
  }
});
```

## Best Practices

1. **Keep Workers Stateless**: Design workers to be stateless for better reliability
2. **Use Transferables**: For large objects (ArrayBuffers, ImageBitmaps), specify transferables to avoid copying
3. **Per-Stream Transferables**: Use `accept({ getTransferables })` for stream-specific transfer behavior
4. **Handle Errors**: Errors automatically propagate to main thread - implement validation in transforms
5. **Worker Reuse**: A single worker can handle multiple concurrent streams efficiently
6. **Batch Processing**: Use buffering operators to reduce message passing overhead

## See Also

- **[bridge operator](./operators/bridge.md)** - Main thread API, options, and detailed examples
- **[buffer operator](./operators/buffer.md)** - Batch values to reduce message overhead
- **[debounceTime operator](./operators/debounceTime.md)** - Reduce frequency for worker processing

## Browser Support

Worker stream processing requires:
- Web Workers support
- ReadableStream support
- Transferable objects support (for performance optimization)

All modern browsers support these features.