# bridge

⚠️ **Experimental** ⚠️

Bridges stream processing to a Web Worker for non-blocking, parallel computation. The worker must implement the `onStream` handler from `web-streams-extensions/workers`. Recommended to use with debouncing/buffering to account for message passing overhead.

## Type Signature

```typescript
interface BridgeOptions<U> {
  timeout?: number;
  signal?: AbortSignal;
  getTransferables?: (value: any) => Transferable[];
}

function bridge<T, U = unknown>(
  worker: Worker,
  name: string,
  options?: BridgeOptions<U>
): (src: ReadableStream<T>, strategy?: QueuingStrategy<U>) => ReadableStream<U>
```

## Parameters

- `worker`: The Web Worker instance that implements the `onStream` handler
- `name`: Stream type name used for worker-side routing
- `options`: Optional configuration for timeouts, cancellation, and transferable objects

## Examples

### Basic Worker Bridge

**Worker (worker.js):**
```typescript
import { onStream } from 'web-streams-extensions/workers';

onStream(({ name, accept, reject }) => {
  if (name !== "double") {
    reject("Unknown stream type");
    return;
  }

  const { readable, writable } = accept();
  
  readable
    .pipeThrough(new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk * 2);
      }
    }))
    .pipeTo(writable);
});
```

**Main Thread:**
```typescript
const worker = new Worker('./worker.js');

const result = await toArray(
  pipe(
    from([1, 2, 3, 4, 5]),
    bridge(worker, 'double')
  )
);
// Input:  1---2---3---4---5---|
// Output: 2---4---6---8---10---| (processed in worker)
// Result: [2, 4, 6, 8, 10]
```


### Multiple Stream Types

**Worker (multi-processor.js):**
```typescript
import { onStream } from 'web-streams-extensions/workers';

onStream(({ name, accept, reject }) => {
  switch (name) {
    case 'uppercase': {
      const { readable, writable } = accept();
      readable
        .pipeThrough(new TransformStream({
          transform(chunk, controller) {
            controller.enqueue(chunk.toUpperCase());
          }
        }))
        .pipeTo(writable);
      break;
    }
      
    case 'square': {
      const { readable, writable } = accept();
      readable
        .pipeThrough(new TransformStream({
          transform(chunk, controller) {
            controller.enqueue(chunk * chunk);
          }
        }))
        .pipeTo(writable);
      break;
    }
      
    default:
      // reject() instead of accept() for unknown streams
      reject(`Unknown operation: ${name}`);
  }
});
```

```typescript
const worker = new Worker('./multi-processor.js');

// Process strings
const strings = await toArray(
  pipe(
    from(['hello', 'world']),
    bridge(worker, 'uppercase')
  )
);
// Result: ['HELLO', 'WORLD']

// Process numbers  
const numbers = await toArray(
  pipe(
    from([2, 3, 4]),
    bridge(worker, 'square')
  )
);
// Result: [4, 9, 16]
```

## Architecture

The bridge operator uses a robust message-passing protocol with automatic:
- **Stream ID management** - Worker generates unique IDs for each stream
- **Backpressure handling** - Pull-based flow control prevents memory issues  
- **Error propagation** - Errors in worker or main thread are properly forwarded
- **Resource cleanup** - Automatic cleanup on completion, error, or cancellation
- **Transferable optimization** - Efficient transfer of large objects when possible

## Performance Notes

- **Message overhead**: Each value requires message passing - use buffering for high-frequency streams
- **Transferable objects**: Use `getTransferables` option for efficient transfer of ArrayBuffers, ImageBitmaps, etc.
- **Worker reuse**: Workers can handle multiple concurrent streams efficiently
- **CPU isolation**: Heavy computations won't block the main thread

## See Also

- [Workers Documentation](../workers.md) - Complete guide to worker stream processing
- [`buffer`](./buffer.md) - Buffer values to reduce message overhead
- [`debounceTime`](./debounceTime.md) - Reduce frequency for worker processing
