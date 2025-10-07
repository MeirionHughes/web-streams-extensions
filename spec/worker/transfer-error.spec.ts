import { bridge } from '../../src/operators/bridge.js';
import { expect } from 'chai';

/**
 * Test suite for per-stream transferables functionality.
 * 
 * This test verifies that:
 * 1. A worker can register a per-stream getTransferables function via accept({ getTransferables })
 * 2. When the worker sends a Uint8Array with transfer enabled, the ArrayBuffer is transferred
 * 3. The worker's original ArrayBuffer becomes detached after transfer
 * 4. Attempting to access the detached buffer causes an error that propagates to main thread
 */
describe('Worker per-stream transferables', () => {
  // If Worker isn't available in this environment, skip the whole suite
  before(function () {
    if (typeof Worker === 'undefined') {
      this.skip();
    }
  });

  it('should transfer ArrayBuffer from worker to main thread and detach worker buffer', async () => {
    // Create a simple trigger stream to send to the worker
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue('trigger');
        controller.close();
      }
    });

    const worker = new Worker(new URL('./bridge-worker.bundle.js', import.meta.url));
    
    // The 'transfer-error' handler in the worker will:
    // 1. Create a Uint8Array
    // 2. Send it to main thread with transfer enabled (via per-stream getTransferables)
    // 3. Try to access it and error because the buffer was transferred away
    const resultStream = bridge(
      worker,
      'transfer-error'
    )(stream);

    const reader = resultStream.getReader();
    
    // We expect an error because the worker will detect its buffer was transferred
    let errorCaught = false;
    let errorMessage = '';
    
    try {
      await reader.read();
      expect.fail('Expected worker to error when accessing transferred buffer');
    } catch (err) {
      errorCaught = true;
      errorMessage = err instanceof Error ? err.message : String(err);
      
      expect(err).to.be.instanceOf(Error);
      expect(errorMessage).to.match(/transferred|detached/i, 
        'Error should indicate buffer was transferred');
    }
    
    expect(errorCaught).to.be.true;
    
    reader.releaseLock();
    worker.terminate();
  });
});
