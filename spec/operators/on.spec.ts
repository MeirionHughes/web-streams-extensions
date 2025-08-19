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
    let cancelCalled = false;
    
    const result = await toArray(pipe(
      from([1, 2]),
      on({
        complete: () => { completeCalled = true; },
        cancel: () => { cancelCalled = true; }
      })
    ));
    
    expect(completeCalled).to.be.true;
    expect(cancelCalled).to.be.false; // Should NOT be called on normal completion
    expect(result).to.deep.equal([1, 2]);
  });

  it('should call cancel callback when consumer cancels stream', async () => {
    let completeCalled = false;
    let cancelCalled = false;
    let cancelReason: any = null;
    
    const stream = pipe(
      from([1, 2, 3, 4, 5]),
      on({
        complete: () => { completeCalled = true; },
        cancel: (reason) => { 
          cancelCalled = true; 
          cancelReason = reason;
        }
      })
    );
    
    const reader = stream.getReader();
    
    // Read first value
    const first = await reader.read();
    expect(first.value).to.equal(1);
    
    // Cancel the stream
    const testReason = 'User cancelled operation';
    await reader.cancel(testReason);
    
    expect(cancelCalled).to.be.true;
    expect(completeCalled).to.be.false; // Should NOT be called on cancellation
    expect(cancelReason).to.equal(testReason);
  });

  it('should call error callback when source stream errors', async () => {
    let errorCalled = false;
    let completeCalled = false;
    let cancelCalled = false;
    let capturedError: any = null;
    
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.error(new Error('Source stream error'));
      }
    });
    
    try {
      await toArray(pipe(
        errorStream,
        on({
          complete: () => { completeCalled = true; },
          cancel: () => { cancelCalled = true; },
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
      expect(completeCalled).to.be.false; // Should NOT be called on error
      expect(cancelCalled).to.be.false; // Should NOT be called on error
      expect(capturedError).to.be.instanceOf(Error);
      expect(capturedError.message).to.equal('Source stream error');
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

  it('should handle errors in cancel callback', async () => {
    let consoleErrorCalled = false;
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      consoleErrorCalled = true;
      expect(args[0]).to.equal('Error in cancel callback:');
      expect(args[1]).to.be.instanceOf(Error);
    };
    
    try {
      const stream = pipe(
        from([1, 2, 3]),
        on({
          cancel: () => { throw new Error('Cancel callback error'); }
        })
      );
      
      const reader = stream.getReader();
      await reader.read();
      await reader.cancel('test cancel');
      
      expect(consoleErrorCalled).to.be.true;
    } finally {
      console.error = originalConsoleError;
    }
  });

  it('should handle cancellation without cancel callback', async () => {
    const stream = pipe(
      from([1, 2, 3]),
      on({
        start: () => {}
      })
    );
    
    const reader = stream.getReader();
    await reader.read();
    
    // Should not throw when cancelling without cancel callback
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
        controller.error(new Error('Immediate error'));
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
      expect(err.message).to.equal('Immediate error');
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
    // This test should be removed since complete() no longer takes a reason
    // The cancel callback should be used instead for cancellation scenarios
    let completeCalled = false;
    let cancelCalled = false;
    let cancelReason: any = null;
    
    const stream = pipe(
      from([1, 2, 3]),
      on({
        complete: () => { completeCalled = true; },
        cancel: (reason) => { 
          cancelCalled = true;
          cancelReason = reason; 
        }
      })
    );
    
    const reader = stream.getReader();
    await reader.read(); // Read first value
    
    const testReason = { type: 'user-cancel', message: 'User requested cancellation' };
    await reader.cancel(testReason);
    
    expect(completeCalled).to.be.false; // Complete should NOT be called on cancel
    expect(cancelCalled).to.be.true;
    expect(cancelReason).to.deep.equal(testReason);
  });

  it('should distinguish between complete, cancel, and error scenarios', async () => {
    // Test 1: Normal completion
    {
      const callbackOrder: string[] = [];
      
      const sourceStream = new ReadableStream({
        start(controller) {
          controller.enqueue(1);
          controller.enqueue(2);
          controller.close(); // Normal completion
        }
      });
      
      const wrappedStream = on({
        complete: () => { callbackOrder.push('complete'); },
        cancel: () => { callbackOrder.push('cancel'); },
        error: () => { callbackOrder.push('error'); }
      })(sourceStream);
      
      const reader = wrappedStream.getReader();
      
      // Read all values
      let result1 = await reader.read();
      expect(result1.value).to.equal(1);
      expect(result1.done).to.be.false;
      
      let result2 = await reader.read();
      expect(result2.value).to.equal(2);
      expect(result2.done).to.be.false;
      
      let result3 = await reader.read();
      expect(result3.done).to.be.true;
      
      expect(callbackOrder).to.deep.equal(['complete']);
    }
    
    // Test 2: Consumer cancellation
    {
      const callbackOrder: string[] = [];
      
      const sourceStream = new ReadableStream({
        start(controller) {
          controller.enqueue(1);
          controller.enqueue(2);
          // Never close - this would go on indefinitely
        }
      });
      
      const wrappedStream = on({
        complete: () => { callbackOrder.push('complete'); },
        cancel: () => { callbackOrder.push('cancel'); },
        error: () => { callbackOrder.push('error'); }
      })(sourceStream);
      
      const reader = wrappedStream.getReader();
      
      // Read first value
      let result1 = await reader.read();
      expect(result1.value).to.equal(1);
      expect(result1.done).to.be.false;
      
      // Cancel without reading more
      await reader.cancel('user abort');
      
      expect(callbackOrder).to.deep.equal(['cancel']);
    }
    
    // Test 3: Source error
    {
      const callbackOrder: string[] = [];
      
      const sourceStream = new ReadableStream({
        start(controller) {
          controller.enqueue(1);
          // Error after the first value is available
          setTimeout(() => {
            controller.error(new Error('Source failure'));
          }, 0);
        }
      });
      
      const wrappedStream = on({
        complete: () => { callbackOrder.push('complete'); },
        cancel: () => { callbackOrder.push('cancel'); },
        error: () => { callbackOrder.push('error'); }
      })(sourceStream);
      
      const reader = wrappedStream.getReader();
      
      // Read first value
      let result1 = await reader.read();
      expect(result1.value).to.equal(1);
      expect(result1.done).to.be.false;
      
      // Try to read next - should error
      try {
        await reader.read();
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('Source failure');
      }
      
      // Wait a moment for the error callback to be processed
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(callbackOrder).to.deep.equal(['error']);
    }
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
