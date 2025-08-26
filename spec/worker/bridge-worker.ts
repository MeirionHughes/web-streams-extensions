// TypeScript version of bridge worker that will be bundled
import { onStream } from '../../src/workers/index.js';

// Simple debug to verify worker context
console.log('Bridge worker starting...');

// Handler for 'double' stream type
function handleDoubleStream(accept: () => { readable: ReadableStream; writable: WritableStream }) {
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
        // Handle typed arrays
        const typedChunk = chunk as Uint8Array; // Cast to a specific typed array
        const result = new (typedChunk.constructor as any)(typedChunk.length);
        for (let i = 0; i < typedChunk.length; i++) {
          (result as any)[i] = typedChunk[i] * 2;
        }
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
function handlePassthroughStream(accept: () => { readable: ReadableStream; writable: WritableStream }) {
  const { readable, writable } = accept();
  
  // Simple passthrough - no transformation
  readable.pipeTo(writable);
}

// Handler for 'delay' stream type - adds artificial delay to test async behavior
function handleDelayStream(accept: () => { readable: ReadableStream; writable: WritableStream }) {
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
function handleErrorStream(accept: () => { readable: ReadableStream; writable: WritableStream }) {
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
function handleImmediateErrorStream(accept: () => { readable: ReadableStream; writable: WritableStream }, reject: (reason: string) => void) {
  reject('Immediate error from worker');
}

// Handler for 'filter-even' stream type - filters to only even numbers
function handleFilterEvenStream(accept: () => { readable: ReadableStream; writable: WritableStream }) {
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

// Register stream handler
onStream(({ name, accept, reject }) => {
  console.log('Worker: Received stream request for:', name);
  
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
      
    case 'no-response':
      // Intentionally don't call accept() or reject() to test timeout
      console.log('Worker: Received no-response request, not responding');
      break;
      
    default:
      // Reject unknown stream types
      reject(`Unknown stream type: ${name}`);
      break;
  }
});

console.log('Bridge worker ready with onStream handler');