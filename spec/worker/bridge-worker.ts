// TypeScript version of bridge worker that will be bundled
import { onStream } from '../../src/workers/index.js';
import { StreamRequestAcceptFunction } from '../../src/workers/protocol.js';

// Handler for 'double' stream type
function handleDoubleStream(accept: StreamRequestAcceptFunction) {
  // Accept and create transform pipeline
  const { readable, writable } = accept();
  
  // Create transform stream that doubles numbers
  const transform = new TransformStream({
    transform(chunk, controller) {
      if (typeof chunk === 'number') {
        controller.enqueue(chunk * 2);
      } else if (Array.isArray(chunk) && chunk.every(v => typeof v === 'number')) {
        controller.enqueue(chunk.map(v => v * 2));
      } else if (ArrayBuffer.isView(chunk)) {
        // Handle typed arrays - create new buffer for transfer efficiency
        const typedChunk = chunk as Uint8Array; // Cast to a specific typed array
        const buffer = new ArrayBuffer(typedChunk.length * typedChunk.BYTES_PER_ELEMENT);
        const result = new (typedChunk.constructor as any)(buffer);
        for (let i = 0; i < typedChunk.length; i++) {
          (result as any)[i] = typedChunk[i] * 2;
        }
        // The buffer will be detected as transferable by getTransferables
        controller.enqueue(result);
      } else {
        // Pass through with transformation indicator
        controller.enqueue(`transformed: ${chunk}`);
      }
    }
  });
  
  // Connect the pipeline
  readable.pipeThrough(transform).pipeTo(writable);
}

// Handler for 'passthrough' stream type - just passes data through unchanged
function handlePassthroughStream(accept: StreamRequestAcceptFunction) {
  const { readable, writable } = accept();
  
  // Simple passthrough - no transformation
  readable.pipeTo(writable);
}

// Handler for 'delay' stream type - adds artificial delay to test async behavior
function handleDelayStream(accept: StreamRequestAcceptFunction) {
  const { readable, writable } = accept();
  
  const transform = new TransformStream({
    async transform(chunk, controller) {
      // Add 10ms delay to test async behavior
      await new Promise(resolve => setTimeout(resolve, 10));
      controller.enqueue(chunk);
    }
  });
  
  readable.pipeThrough(transform).pipeTo(writable);
}

// Handler for 'error' stream type - throws an error to test error handling
function handleErrorStream(accept: StreamRequestAcceptFunction) {
  const { readable, writable } = accept();
  
  const transform = new TransformStream({
    transform(chunk, controller) {
      if (chunk === 'error') {
        throw new Error('Test error from worker');
      }
      controller.enqueue(chunk);
    }
  });
  
  readable.pipeThrough(transform).pipeTo(writable);
}

// Handler for 'immediate-error' stream type - rejects immediately to test reject handling
function handleImmediateErrorStream(accept: StreamRequestAcceptFunction, reject: (reason: string) => void) {
  reject('Immediate error from worker');
}

// Handler for 'filter-even' stream type - filters to only even numbers
function handleFilterEvenStream(accept: StreamRequestAcceptFunction) {
  const { readable, writable } = accept();
  
  const transform = new TransformStream({
    transform(chunk, controller) {
      if (typeof chunk === 'number' && chunk % 2 === 0) {
        controller.enqueue(chunk);
      }
      // Filter out odd numbers by not enqueuing them
    }
  });
  
  readable.pipeThrough(transform).pipeTo(writable);
}

// Handler for 'transfer-error' stream type
// Tests per-stream transferables functionality:
// 1. Registers a per-stream getTransferables function that transfers Uint8Array buffers
// 2. Creates a Uint8Array and sends it to main thread
// 3. Verifies the buffer was transferred by checking if it's detached
function handleTransferErrorStream(accept: StreamRequestAcceptFunction) {
  // Register per-stream getTransferables that will transfer Uint8Array buffers
  const { readable, writable } = accept({
    getTransferables: (value: any) => {
      if (value instanceof Uint8Array || ArrayBuffer.isView(value)) {
        return [(value as any).buffer];
      }
      return [];
    }
  });
  
  let workerArray: Uint8Array;
  let checkPromise: Promise<void>;
  
  const transform = new TransformStream({
    async transform(chunk, controller) {
      // Create a Uint8Array in the worker
      workerArray = new Uint8Array([10, 20, 30, 40]);
      
      // Send it to main thread - the per-stream getTransferables will transfer the buffer
      controller.enqueue(workerArray);
      
      // Check after a delay to ensure the transfer has completed
      checkPromise = new Promise((resolve) => setTimeout(resolve, 50)).then(() => {
        // If the buffer was transferred, it should be detached (byteLength === 0)
        if (workerArray.buffer.byteLength === 0) {
          throw new Error('ArrayBuffer was transferred to main thread - worker buffer is now detached');
        } else {
          throw new Error(`ArrayBuffer was NOT transferred - worker can still access buffer (byteLength: ${workerArray.buffer.byteLength})`);
        }
      });
    },
    
    async flush(controller) {
      if (checkPromise) {
        try {
          await checkPromise;
        } catch (err) {
          controller.error(err);
          throw err;
        }
      }
    }
  });
  
  readable.pipeThrough(transform).pipeTo(writable);
}

// Register stream handler
onStream(({ name, accept, reject }) => {
  switch (name) {
    case 'double':
      handleDoubleStream(accept);
      break;
    case 'passthrough':
      handlePassthroughStream(accept);
      break;
    case 'delay':
      handleDelayStream(accept);
      break;
    case 'error':
      handleErrorStream(accept);
      break;
    case 'immediate-error':
      handleImmediateErrorStream(accept, reject);
      break;
    case 'filter-even':
      handleFilterEvenStream(accept);
      break;
    case 'transfer-error':
      handleTransferErrorStream(accept);
      break;
    case 'no-response':
      // Intentionally don't call accept() or reject() to test timeout
      break;
    default:
      // Reject unknown stream types
      reject(`Unknown stream type: ${name}`);
      break;
  }
}, (value: any) => {
  // Global getTransferables function for the worker
  // Transfer buffers from TypedArrays and ArrayBuffers
  if (value instanceof Uint8Array || ArrayBuffer.isView(value)) {
    return [(value as any).buffer];
  }
  
  if (value instanceof ArrayBuffer) {
    return [value];
  }
  
  // No transferables for other types
  return [];
});