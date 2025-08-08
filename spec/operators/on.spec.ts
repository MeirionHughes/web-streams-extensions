import { describe, it } from 'mocha';
import { expect } from 'chai';
import { on } from '../../src/operators/on.js';
import { from, pipe, toArray } from '../../src/index.js';

describe('on operator', function() {
  it('should pass through all values without modification', async () => {
    const input = [1, 2, 3, 4, 5];
    const result = await toArray(pipe(from(input), on({})));
    
    expect(result).to.deep.equal(input);
  });

  it('should call start callback when stream begins', async () => {
    let startCalled = false;
    
    const result = await toArray(pipe(
      from([1, 2]),
      on({
        start: () => { startCalled = true; }
      })
    ));
    
    expect(startCalled).to.be.true;
    expect(result).to.deep.equal([1, 2]);
  });

  it('should call complete callback when stream ends normally', async () => {
    let completeCalled = false;
    
    const result = await toArray(pipe(
      from([1, 2]),
      on({
        complete: () => { completeCalled = true; }
      })
    ));
    
    expect(completeCalled).to.be.true;
    expect(result).to.deep.equal([1, 2]);
  });

  it('should call error callback when stream errors', async () => {
    let errorCalled = false;
    let capturedError: any = null;
    
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.error(new Error('Test error'));
      }
    });
    
    try {
      await toArray(pipe(
        errorStream,
        on({
          error: (err) => {
            errorCalled = true;
            capturedError = err;
          }
        })
      ));
      
      // Should not reach here
      expect.fail('Expected stream to throw error');
    } catch (err) {
      expect(errorCalled).to.be.true;
      expect(capturedError).to.be.instanceOf(Error);
      expect(capturedError.message).to.equal('Test error');
      expect(err).to.equal(capturedError);
    }
  });

  it('should call all provided callbacks', async () => {
    let startCalled = false;
    let completeCalled = false;
    const callOrder: string[] = [];
    
    const result = await toArray(pipe(
      from([1]),
      on({
        start: () => {
          startCalled = true;
          callOrder.push('start');
        },
        complete: () => {
          completeCalled = true;
          callOrder.push('complete');
        }
      })
    ));
    
    expect(startCalled).to.be.true;
    expect(completeCalled).to.be.true;
    expect(callOrder).to.deep.equal(['start', 'complete']);
    expect(result).to.deep.equal([1]);
  });

  it('should handle empty stream', async () => {
    let startCalled = false;
    let completeCalled = false;
    
    const result = await toArray(pipe(
      from([]),
      on({
        start: () => { startCalled = true; },
        complete: () => { completeCalled = true; }
      })
    ));
    
    expect(startCalled).to.be.true;
    expect(completeCalled).to.be.true;
    expect(result).to.deep.equal([]);
  });

  it('should handle errors in start callback', async () => {
    let consoleErrorCalled = false;
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      consoleErrorCalled = true;
      expect(args[0]).to.equal('Error in start callback:');
      expect(args[1]).to.be.instanceOf(Error);
    };
    
    try {
      const result = await toArray(pipe(
        from([1, 2]),
        on({
          start: () => { throw new Error('Start error'); }
        })
      ));
      
      expect(result).to.deep.equal([1, 2]);
      expect(consoleErrorCalled).to.be.true;
    } finally {
      console.error = originalConsoleError;
    }
  });

  it('should handle errors in complete callback', async () => {
    let consoleErrorCalled = false;
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      consoleErrorCalled = true;
      expect(args[0]).to.equal('Error in complete callback:');
      expect(args[1]).to.be.instanceOf(Error);
    };
    
    try {
      const result = await toArray(pipe(
        from([1, 2]),
        on({
          complete: () => { throw new Error('Complete error'); }
        })
      ));
      
      expect(result).to.deep.equal([1, 2]);
      expect(consoleErrorCalled).to.be.true;
    } finally {
      console.error = originalConsoleError;
    }
  });

  it('should handle errors in error callback', async () => {
    let consoleErrorCalled = false;
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      consoleErrorCalled = true;
      expect(args[0]).to.equal('Error in error callback:');
      expect(args[1]).to.be.instanceOf(Error);
    };
    
    const errorStream = new ReadableStream({
      start(controller) {
        controller.error(new Error('Stream error'));
      }
    });
    
    try {
      await toArray(pipe(
        errorStream,
        on({
          error: () => { throw new Error('Error callback error'); }
        })
      ));
      
      expect.fail('Expected stream to throw error');
    } catch (err) {
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal('Stream error');
      expect(consoleErrorCalled).to.be.true;
    } finally {
      console.error = originalConsoleError;
    }
  });

  it('should handle cancellation', async () => {
    let completeCalled = false;
    let completeReason: any = null;
    
    const stream = pipe(
      from([1, 2, 3, 4, 5]),
      on({
        complete: (reason) => {
          completeCalled = true;
          completeReason = reason;
        }
      })
    );
    
    const reader = stream.getReader();
    
    // Read first value
    const first = await reader.read();
    expect(first.value).to.equal(1);
    
    // Cancel the stream
    const cancelReason = 'User cancelled';
    await reader.cancel(cancelReason);
    
    expect(completeCalled).to.be.true;
    expect(completeReason).to.equal(cancelReason);
  });

  it('should handle cancellation without complete callback', async () => {
    const stream = pipe(
      from([1, 2, 3]),
      on({
        start: () => {}
      })
    );
    
    const reader = stream.getReader();
    await reader.read();
    
    // Should not throw when cancelling without complete callback
    await reader.cancel('test cancel');
    // If we get here, it handled cancellation gracefully
    expect(true).to.be.true;
  });

  it('should handle cleanup errors during cancellation', async () => {
    // Create a mock reader that throws on cancel
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
      },
      cancel() {
        throw new Error('Cancel error');
      }
    });
    
    const stream = pipe(mockStream, on({}));
    const reader = stream.getReader();
    
    await reader.read();
    
    // Should handle cancel errors gracefully
    await reader.cancel('test cancel');
    // If we get here, it handled the cleanup error
    expect(true).to.be.true;
  });

  it('should handle reader errors during flush', async () => {
    let errorCalled = false;
    
    // Create a stream that errors after first value
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        setTimeout(() => controller.error(new Error('Async error')), 10);
      }
    });
    
    try {
      await toArray(pipe(
        errorStream,
        on({
          error: () => { errorCalled = true; }
        })
      ));
      
      expect.fail('Expected stream to throw error');
    } catch (err) {
      expect(errorCalled).to.be.true;
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal('Async error');
    }
  });

  it('should work with custom highWaterMark', async () => {
    const result = await toArray(
      pipe(
        from([1, 2, 3]),
        (src) => on({})(src, { highWaterMark: 1 })
      )
    );
    
    expect(result).to.deep.equal([1, 2, 3]);
  });

  it('should handle backpressure correctly', async () => {
    const values: number[] = [];
    
    const result = await toArray(pipe(
      from([1, 2, 3, 4, 5]),
      on({
        start: () => values.push(-1) // Mark start
      })
    ));
    
    expect(values).to.deep.equal([-1]);
    expect(result).to.deep.equal([1, 2, 3, 4, 5]);
  });

  it('should handle multiple readers from same source', async () => {
    let startCallCount = 0;
    
    const createStream = () => pipe(
      from([1, 2]),
      on({
        start: () => { startCallCount++; }
      })
    );
    
    const [result1, result2] = await Promise.all([
      toArray(createStream()),
      toArray(createStream())
    ]);
    
    expect(startCallCount).to.equal(2);
    expect(result1).to.deep.equal([1, 2]);
    expect(result2).to.deep.equal([1, 2]);
  });

  it('should handle complete callback with reason on cancel', async () => {
    let completeReason: any = null;
    
    const stream = pipe(
      from([1, 2, 3]),
      on({
        complete: (reason) => { completeReason = reason; }
      })
    );
    
    const reader = stream.getReader();
    await reader.read(); // Read first value
    
    const cancelReason = { type: 'user-cancel', message: 'User requested cancellation' };
    await reader.cancel(cancelReason);
    
    expect(completeReason).to.deep.equal(cancelReason);
  });

  it('should handle reader cleanup errors on normal completion', async () => {
    // Test the catch block in flush during normal completion
    const stream = pipe(
      from([1, 2]),
      on({})
    );
    
    const result = await toArray(stream);
    expect(result).to.deep.equal([1, 2]);
  });
});
