
import { expect } from 'chai';
import { IdleScheduler } from '../../src/schedulers/idle-scheduler.js';
import { sleep } from '../../src/utils/sleep.js';

describe('IdleScheduler', () => {
  let scheduler: IdleScheduler;

  beforeEach(() => {
    scheduler = new IdleScheduler();
  });

  it('should create an instance', () => {
    expect(scheduler).to.be.instanceOf(IdleScheduler);
    expect(scheduler.schedule).to.be.a('function');
  });

  it('should execute callback with schedule', async () => {
    let executed = false;
    // Should not execute immediately
    expect(executed).to.be.false;
    
    await new Promise<void>((resolve) => {
      scheduler.schedule(() => {
        executed = true;
        expect(executed).to.be.true;
        resolve();
      });
    });
  });

  it('should work with multiple consecutive schedule calls', async () => {
    const results: number[] = [];
    let completed = 0;
    
    await new Promise<void>((resolve) => {
      const checkComplete = () => {
        completed++;
        if (completed === 3) {
          expect(results).to.have.lengthOf(3);
          expect(results).to.include.members([1, 2, 3]);
          resolve();
        }
      };
      
      scheduler.schedule(() => { results.push(1); checkComplete(); });
      scheduler.schedule(() => { results.push(2); checkComplete(); });
      scheduler.schedule(() => { results.push(3); checkComplete(); });
    });
  });

  it('should handle concurrent schedule calls', async () => {
    let completed = 0;
    const total = 5;
    
    await new Promise<void>((resolve) => {
      const checkComplete = () => {
        completed++;
        if (completed === total) {
          resolve();
        }
      };
      
      for (let i = 0; i < total; i++) {
        scheduler.schedule(checkComplete);
      }
    });
  });

  describe('environment-specific behavior', () => {
    let originalRequestIdleCallback: typeof globalThis.requestIdleCallback;
    let originalSetImmediate: typeof setImmediate;

    beforeEach(() => {
      originalRequestIdleCallback = globalThis.requestIdleCallback;
      originalSetImmediate = (globalThis as any).setImmediate;
    });

    afterEach(() => {
      globalThis.requestIdleCallback = originalRequestIdleCallback;
      (globalThis as any).setImmediate = originalSetImmediate;
    });

    it('should use requestIdleCallback when available', async () => {
      let idleCallbackCalled = false;
      const originalRequestIdleCallback = globalThis.requestIdleCallback;
      
      globalThis.requestIdleCallback = (callback: IdleRequestCallback) => {
        idleCallbackCalled = true;
        setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 }), 0);
        return 0;
      };

      // Create scheduler after setting up the mock
      const scheduler = new IdleScheduler();

      await new Promise<void>((resolve) => {
        scheduler.schedule(() => {
          expect(idleCallbackCalled).to.be.true;
          globalThis.requestIdleCallback = originalRequestIdleCallback;
          resolve();
        });
      });
    });

    it('should fall back to setImmediate when requestIdleCallback is not available', async () => {
      const originalRequestIdleCallback = globalThis.requestIdleCallback;
      const originalSetImmediate = (globalThis as any).setImmediate;
      
      delete (globalThis as any).requestIdleCallback;
      
      let setImmediateCalled = false;
      (globalThis as any).setImmediate = (callback: () => void) => {
        setImmediateCalled = true;
        setTimeout(callback, 0);
      };

      // Create scheduler after setting up the environment
      const scheduler = new IdleScheduler();

      await new Promise<void>((resolve) => {
        scheduler.schedule(() => {
          expect(setImmediateCalled).to.be.true;
          globalThis.requestIdleCallback = originalRequestIdleCallback;
          (globalThis as any).setImmediate = originalSetImmediate;
          resolve();
        });
      });
    });

    it('should fall back to setTimeout when neither requestIdleCallback nor setImmediate are available', async () => {
      const originalRequestIdleCallback = globalThis.requestIdleCallback;
      const originalSetImmediate = (globalThis as any).setImmediate;
      const originalSetTimeout = globalThis.setTimeout;
      
      delete (globalThis as any).requestIdleCallback;
      delete (globalThis as any).setImmediate;
      
      let setTimeoutCalled = false;
      globalThis.setTimeout = ((callback: () => void, delay?: number) => {
        setTimeoutCalled = true;
        expect(delay).to.equal(0);
        return originalSetTimeout(callback, delay);
      }) as typeof setTimeout;

      // Create scheduler after setting up the environment
      const scheduler = new IdleScheduler();

      await new Promise<void>((resolve) => {
        scheduler.schedule(() => {
          expect(setTimeoutCalled).to.be.true;
          globalThis.requestIdleCallback = originalRequestIdleCallback;
          (globalThis as any).setImmediate = originalSetImmediate;
          globalThis.setTimeout = originalSetTimeout;
          resolve();
        });
      });
    });

    it('should handle requestIdleCallback as non-function', async () => {
      const originalRequestIdleCallback = globalThis.requestIdleCallback;
      const originalSetImmediate = (globalThis as any).setImmediate;
      
      (globalThis as any).requestIdleCallback = 'not a function';
      
      let setImmediateCalled = false;
      (globalThis as any).setImmediate = (callback: () => void) => {
        setImmediateCalled = true;
        setTimeout(callback, 0);
      };

      // Create scheduler after setting up the environment
      const scheduler = new IdleScheduler();

      await new Promise<void>((resolve) => {
        scheduler.schedule(() => {
          expect(setImmediateCalled).to.be.true;
          globalThis.requestIdleCallback = originalRequestIdleCallback;
          (globalThis as any).setImmediate = originalSetImmediate;
          resolve();
        });
      });
    });

    it('should handle missing globalThis', async () => {
      const originalGlobalThis = globalThis;
      
      try {
        // Simulate environment without globalThis (works in both Node.js and browser)
        if (typeof window !== 'undefined') {
          // Browser environment
          (window as any).globalThis = undefined;
        } else {
          // Node.js environment
          (global as any).globalThis = undefined;
        }
        
        const scheduler = new IdleScheduler();
        
        // Should fall back to setTimeout without throwing
        await new Promise<void>((resolve) => {
          scheduler.schedule(() => {
            resolve();
          });
        });
      } finally {
        if (typeof window !== 'undefined') {
          (window as any).globalThis = originalGlobalThis;
        } else {
          (global as any).globalThis = originalGlobalThis;
        }
      }
    });
  });

  describe('performance characteristics', () => {
    it('should not block for extended periods', async () => {
      await new Promise<void>((resolve) => {
        scheduler.schedule(() => {
          resolve();
        });
      });
      // If we reach here, the callback executed without blocking indefinitely
    });

    it('should allow other operations to run between schedule calls', async () => {
      const results: string[] = [];
      let scheduledCount = 0;
      
      await new Promise<void>((resolve) => {
        scheduler.schedule(() => {
          results.push('scheduled1');
          scheduledCount++;
          if (scheduledCount === 2) resolve();
        });
        Promise.resolve().then(() => results.push('microtask1'));
        scheduler.schedule(() => {
          results.push('scheduled2');
          scheduledCount++;
          if (scheduledCount === 2) resolve();
        });
        Promise.resolve().then(() => results.push('microtask2'));
      });
      
      // Verify all operations completed
      expect(results).to.have.lengthOf(4);
      expect(results).to.include.members(['scheduled1', 'microtask1', 'scheduled2', 'microtask2']);
    });
  });
});
