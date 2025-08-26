# Workers

Support for processing streams in Web Workers for non-blocking operation and parallel processing.

## Overview

The worker utilities allow you to offload stream processing to Web Workers, enabling:
- Non-blocking stream operations in the main thread
- Parallel processing of multiple streams
- CPU-intensive operations without UI blocking
- Proper handling of transferable objects for performance

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

## API Reference

### `bridge(worker, name, options?)`

Creates a bridge operator that processes streams in a Web Worker. Used in the main thread as a pipe operator.

#### Parameters

- `worker: Worker` - The Web Worker instance running the `onStream` handler
- `name: string` - Stream type name for worker routing
- `options?: BridgeOptions` - Configuration options

#### BridgeOptions

```typescript
interface BridgeOptions<U = unknown> {
  signal?: AbortSignal;           // For cancellation
  timeoutMs?: number;             // Timeout for stream setup
  getTransferables?: GetTransferablesFn; // Custom transferable extraction
  validate?(value: unknown): value is U; // Runtime type validation
}
```

#### Example

```typescript
import { bridge } from 'web-streams-extensions';
import { pipe } from 'web-streams-extensions';

const processedStream = pipe(
  inputStream,
  bridge(worker, 'double', {
    timeoutMs: 5000,
    signal: abortController.signal
  })
);
```

### `onStream(handler, getTransferables?)`

Register a stream handler in a Worker context.

#### Parameters

- `handler: StreamHandler` - Function that processes incoming stream requests
- `getTransferables?: GetTransferablesFn` - Optional function to extract transferable objects

#### StreamHandler Type

```typescript
type StreamHandler = (request: StreamRequest) => void;

interface StreamRequest {
  name: string;
  accept(): { readable: ReadableStream; writable: WritableStream };
  reject(reason?: any): void;
}
```

#### Example: Image Processing Worker

```typescript
// image-worker.js
import { onStream } from 'web-streams-extensions/workers';

onStream(({ name, accept, reject }) => {
  if (name === 'process-image') {
    const { readable, writable } = accept();
    
    readable
      .pipeThrough(new TransformStream({
        async transform(imageData, controller) {
          // CPU-intensive image processing
          const processed = await processImage(imageData);
          controller.enqueue(processed);
        }
      }))
      .pipeTo(writable);
  } else {
    reject(`Unknown stream type: ${name}`);
  }
}, (value) => {
  // Extract ImageData transferables for performance
  if (value instanceof ImageData) {
    return [value.data.buffer];
  }
  return [];
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

## Use Cases

### CPU-Intensive Processing

```typescript
// worker.js - Mathematical computations
onStream(({ name, accept, reject }) => {
  if (name === 'compute') {
    const { readable, writable } = accept();
    
    readable
      .pipeThrough(new TransformStream({
        transform(data, controller) {
          const result = performComplexCalculation(data);
          controller.enqueue(result);
        }
      }))
      .pipeTo(writable);
  } else {
    reject(`Unknown stream type: ${name}`);
  }
});
```

### Parallel Stream Processing

```typescript
// main.js - Process multiple streams in parallel
import { bridge } from 'web-streams-extensions';
import { pipe } from 'web-streams-extensions';

const workers = Array.from({ length: 4 }, () => 
  new Worker('./processor.js', { type: 'module' })
);

const processedStreams = inputStreams.map((stream, index) => 
  pipe(
    stream,
    bridge(workers[index % workers.length], 'process')
  )
);
```

### Real-time Data Processing

```typescript
// worker.js - Audio/video processing
onStream(({ name, accept, reject }) => {
  if (name === 'audio-filter') {
    const { readable, writable } = accept();
    
    readable
      .pipeThrough(new TransformStream({
        transform(audioChunk, controller) {
          const filtered = applyAudioFilter(audioChunk);
          controller.enqueue(filtered);
        }
      }))
      .pipeTo(writable);
  } else {
    reject(`Unknown stream type: ${name}`);
  }
});
```

## Error Handling

Workers automatically handle errors and propagate them to the main thread:

```typescript
onStream(({ name, accept, reject }) => {
  if (name === 'validate-data') {
    const { readable, writable } = accept();
    
    readable
      .pipeThrough(new TransformStream({
        transform(data, controller) {
          if (!isValid(data)) {
            throw new Error('Invalid data format');
          }
          controller.enqueue(processData(data));
        }
      }))
      .pipeTo(writable);
  } else {
    reject(`Unknown stream type: ${name}`);
  }
});
```

## Best Practices

1. **Keep Workers Stateless**: Design workers to be stateless for better reliability
2. **Use Transferables**: For large objects, always specify transferable objects
3. **Handle Errors**: Implement proper error handling in worker stream handlers
4. **Resource Cleanup**: Workers are automatically cleaned up when streams complete
5. **Batch Processing**: Use buffering operators for efficient batch processing

## Browser Support

Worker stream processing requires:
- Web Workers support
- ReadableStream support
- Transferable objects support (for performance optimization)

All modern browsers support these features.