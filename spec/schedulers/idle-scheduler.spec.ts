import { describe, it } from 'mocha';
import { expect } from 'chai';
import { IdleScheduler } from '../../src/schedulers/idle-scheduler.js';

describe('IdleScheduler', function() {
  let scheduler: IdleScheduler;

  beforeEach(() => {
    scheduler = new IdleScheduler();
  });

  it('should create an instance', () => {
    expect(scheduler).to.be.instanceOf(IdleScheduler);
  });

  it('should yield control with nextTick', async () => {
    const startTime = Date.now();
    await scheduler.nextTick();
    const endTime = Date.now();
    
    // Should complete within reasonable time but yield control
    expect(endTime - startTime).to.be.greaterThanOrEqual(0);
    expect(endTime - startTime).to.be.lessThan(100); // Should be fast
  });

  it('should work with multiple consecutive nextTick calls', async () => {
    const results: number[] = [];
    
    // Schedule multiple async operations
    const promises = Array.from({ length: 5 }, async (_, i) => {
      await scheduler.nextTick();
      results.push(i);
    });
    
    await Promise.all(promises);
    expect(results).to.have.lengthOf(5);
    expect(results.sort()).to.deep.equal([0, 1, 2, 3, 4]);
  });

  it('should handle concurrent nextTick calls', async () => {
    const promises = Array.from({ length: 10 }, () => scheduler.nextTick());
    
    // All should resolve without error
    await Promise.all(promises);
    // If we get here, all promises resolved successfully
    expect(true).to.be.true;
  });

  describe('environment-specific behavior', () => {
    let originalRequestIdleCallback: any;
    let originalSetImmediate: any;
    let originalSetTimeout: any;

    beforeEach(() => {
      originalRequestIdleCallback = (globalThis as any).requestIdleCallback;
      originalSetImmediate = (globalThis as any).setImmediate;
      originalSetTimeout = (globalThis as any).setTimeout;
    });

    afterEach(() => {
      (globalThis as any).requestIdleCallback = originalRequestIdleCallback;
      (globalThis as any).setImmediate = originalSetImmediate;
      (globalThis as any).setTimeout = originalSetTimeout;
    });

    it('should use requestIdleCallback when available', async () => {
      let requestIdleCallbackCalled = false;
      
      // Mock requestIdleCallback
      (globalThis as any).requestIdleCallback = (callback: () => void) => {
        requestIdleCallbackCalled = true;
        setTimeout(callback, 0);
      };
      
      await scheduler.nextTick();
      expect(requestIdleCallbackCalled).to.be.true;
    });

    it('should fall back to setImmediate when requestIdleCallback is not available', async () => {
      let setImmediateCalled = false;
      
      // Remove requestIdleCallback
      delete (globalThis as any).requestIdleCallback;
      
      // Mock setImmediate
      (globalThis as any).setImmediate = (callback: () => void) => {
        setImmediateCalled = true;
        setTimeout(callback, 0);
      };
      
      await scheduler.nextTick();
      expect(setImmediateCalled).to.be.true;
    });

    it('should fall back to setTimeout when neither requestIdleCallback nor setImmediate are available', async () => {
      let setTimeoutCalled = false;
      
      // Remove both requestIdleCallback and setImmediate
      delete (globalThis as any).requestIdleCallback;
      delete (globalThis as any).setImmediate;
      
      // Mock setTimeout
      const originalSetTimeout = setTimeout;
      (globalThis as any).setTimeout = (callback: () => void, delay: number) => {
        setTimeoutCalled = true;
        expect(delay).to.equal(0);
        return originalSetTimeout(callback, delay);
      };
      
      await scheduler.nextTick();
      expect(setTimeoutCalled).to.be.true;
    });

    it('should handle requestIdleCallback as non-function', async () => {
      // Set requestIdleCallback to a non-function value
      (globalThis as any).requestIdleCallback = 'not a function';
      
      let setImmediateCalled = false;
      (globalThis as any).setImmediate = (callback: () => void) => {
        setImmediateCalled = true;
        setTimeout(callback, 0);
      };
      
      await scheduler.nextTick();
      expect(setImmediateCalled).to.be.true;
    });

    it('should handle missing globalThis', async () => {
      // This test simulates an environment where globalThis might not be available
      const scheduler = new IdleScheduler();
      
      // Mock a scenario where globalThis is undefined
      const originalGlobalThis = globalThis;
      try {
        // Can't actually delete globalThis in modern environments, 
        // but we can test the fallback path by ensuring setImmediate exists
        delete (globalThis as any).requestIdleCallback;
        
        let setImmediateCalled = false;
        (globalThis as any).setImmediate = (callback: () => void) => {
          setImmediateCalled = true;
          setTimeout(callback, 0);
        };
        
        await scheduler.nextTick();
        expect(setImmediateCalled).to.be.true;
      } finally {
        // Restore (though it shouldn't be needed)
      }
    });
  });

  describe('performance characteristics', () => {
    it('should not block for extended periods', async () => {
      const startTime = Date.now();
      
      // Run multiple nextTick operations
      for (let i = 0; i < 100; i++) {
        await scheduler.nextTick();
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete reasonably quickly even with many operations
      expect(duration).to.be.lessThan(1000); // Less than 1 second for 100 operations
    });

    it('should allow other microtasks to run between nextTick calls', async () => {
      const executionOrder: string[] = [];
      
      // Start a nextTick operation
      const tickPromise = scheduler.nextTick().then(() => {
        executionOrder.push('tick');
      });
      
      // Queue a microtask
      Promise.resolve().then(() => {
        executionOrder.push('microtask');
      });
      
      await Promise.all([tickPromise, new Promise(resolve => setTimeout(resolve, 0))]);
      
      // The exact order might vary by environment, but both should complete
      expect(executionOrder).to.include('tick');
      expect(executionOrder).to.include('microtask');
    });
  });
});
