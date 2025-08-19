
import { expect } from 'chai';
import { FrameScheduler } from '../../src/schedulers/frame-scheduler.js';

describe('FrameScheduler', () => {
  let scheduler: FrameScheduler;

  beforeEach(() => {
    scheduler = new FrameScheduler();
  });

  it('should create an instance', () => {
    expect(scheduler).to.be.instanceOf(FrameScheduler);
    expect(scheduler.schedule).to.be.a('function');
  });

  it('should execute callback with schedule', async () => {
    let executed = false;
    
    await new Promise<void>((resolve) => {
      scheduler.schedule(() => {
        executed = true;
        expect(executed).to.be.true;
        resolve();
      });
      // Should not execute immediately
      expect(executed).to.be.false;
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
    let originalRequestAnimationFrame: typeof globalThis.requestAnimationFrame;
    let originalSetImmediate: typeof setImmediate;

    beforeEach(() => {
      originalRequestAnimationFrame = globalThis.requestAnimationFrame;
      originalSetImmediate = (globalThis as any).setImmediate;
    });

    afterEach(() => {
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
      (globalThis as any).setImmediate = originalSetImmediate;
    });

    it('should use requestAnimationFrame when available', async () => {
      let rafCalled = false;
      const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
      
      globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
        rafCalled = true;
        setTimeout(() => callback(performance.now()), 0);
        return 0;
      };

      // Create scheduler after setting up the mock
      const scheduler = new FrameScheduler();
      
      await new Promise<void>((resolve) => {
        scheduler.schedule(() => {
          expect(rafCalled).to.be.true;
          globalThis.requestAnimationFrame = originalRequestAnimationFrame;
          resolve();
        });
      });
    });

    it('should fall back to setImmediate when requestAnimationFrame is not available', async () => {
      const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
      const originalSetImmediate = (globalThis as any).setImmediate;
      
      delete (globalThis as any).requestAnimationFrame;
      
      let setImmediateCalled = false;
      (globalThis as any).setImmediate = (callback: () => void) => {
        setImmediateCalled = true;
        setTimeout(callback, 0);
      };

      // Create scheduler after setting up the environment
      const scheduler = new FrameScheduler();

      await new Promise<void>((resolve) => {
        scheduler.schedule(() => {
          expect(setImmediateCalled).to.be.true;
          globalThis.requestAnimationFrame = originalRequestAnimationFrame;
          (globalThis as any).setImmediate = originalSetImmediate;
          resolve();
        });
      });
    });

    it('should fall back to setTimeout when neither requestAnimationFrame nor setImmediate are available', async () => {
      const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
      const originalSetImmediate = (globalThis as any).setImmediate;
      const originalSetTimeout = globalThis.setTimeout;
      
      delete (globalThis as any).requestAnimationFrame;
      delete (globalThis as any).setImmediate;
      
      let setTimeoutCalled = false;
      globalThis.setTimeout = ((callback: () => void, delay?: number) => {
        setTimeoutCalled = true;
        expect(delay).to.equal(16); // Should use 16ms for 60fps approximation
        return originalSetTimeout(callback, delay);
      }) as typeof setTimeout;

      // Create scheduler after setting up the environment
      const scheduler = new FrameScheduler();

      await new Promise<void>((resolve) => {
        scheduler.schedule(() => {
          expect(setTimeoutCalled).to.be.true;
          globalThis.requestAnimationFrame = originalRequestAnimationFrame;
          (globalThis as any).setImmediate = originalSetImmediate;
          globalThis.setTimeout = originalSetTimeout;
          resolve();
        });
      });
    });

    it('should handle requestAnimationFrame as non-function', async () => {
      const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
      const originalSetImmediate = (globalThis as any).setImmediate;
      
      (globalThis as any).requestAnimationFrame = 'not a function';
      
      let setImmediateCalled = false;
      (globalThis as any).setImmediate = (callback: () => void) => {
        setImmediateCalled = true;
        setTimeout(callback, 0);
      };

      // Create scheduler after setting up the environment
      const scheduler = new FrameScheduler();

      await new Promise<void>((resolve) => {
        scheduler.schedule(() => {
          expect(setImmediateCalled).to.be.true;
          globalThis.requestAnimationFrame = originalRequestAnimationFrame;
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
        
        const scheduler = new FrameScheduler();
        
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
      const start = Date.now();
      await new Promise<void>((resolve) => {
        scheduler.schedule(() => {
          const elapsed = Date.now() - start;
          expect(elapsed).to.be.lessThan(100);
          resolve();
        });
      });
    });

    it('should allow other operations to run between schedule calls', async () => {
      const results: string[] = [];
      
      scheduler.schedule(() => results.push('scheduled1'));
      Promise.resolve().then(() => results.push('microtask1'));
      scheduler.schedule(() => results.push('scheduled2'));
      Promise.resolve().then(() => results.push('microtask2'));
      
      // Check results after all have had time to execute
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(results).to.have.lengthOf(4);
          expect(results).to.include.members(['scheduled1', 'microtask1', 'scheduled2', 'microtask2']);
          resolve();
        }, 50);
      });
    });

    it('should work with animation-like timing patterns', async () => {
      const frameCount = 3;
      const frameTimes: number[] = [];
      let completed = 0;
      
      await new Promise<void>((resolve) => {
        const scheduleFrame = () => {
          const start = performance.now();
          scheduler.schedule(() => {
            frameTimes.push(performance.now() - start);
            completed++;
            
            if (completed < frameCount) {
              scheduleFrame();
            } else {
              // All frame times should be reasonable (not too long)
              frameTimes.forEach(time => {
                expect(time).to.be.lessThan(100); // Each frame should complete within 100ms
              });
              resolve();
            }
          });
        };
        
        scheduleFrame();
      });
    });
  });
});
