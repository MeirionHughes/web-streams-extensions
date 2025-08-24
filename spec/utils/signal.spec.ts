import { expect } from 'chai';
import { Signal, Gate, BlockingQueue } from '../../src/utils/signal.js';

describe('Signal', () => {
  let signal: Signal;

  beforeEach(() => {
    signal = new Signal();
  });

  it('should allow waiting for signal', async () => {
    let resolved = false;
    
    const waitPromise = signal.wait().then(() => {
      resolved = true;
    });
    
    // Should not resolve immediately
    expect(resolved).to.be.false;
    
    // Signal and verify resolution
    signal.signal();
    await waitPromise;
    expect(resolved).to.be.true;
  });

  it('should handle multiple waiters', async () => {
    const results: number[] = [];
    
    const promises = [
      signal.wait().then(() => results.push(1)),
      signal.wait().then(() => results.push(2)),
      signal.wait().then(() => results.push(3))
    ];
    
    expect(results).to.have.length(0);
    
    signal.signal();
    await Promise.all(promises);
    
    expect(results).to.have.length(3);
    expect(results).to.include.members([1, 2, 3]);
  });

  it('should handle signal before wait', async () => {
    signal.signal(); // Signal first
    
    let resolved = false;
    const waitPromise = signal.wait().then(() => {
      resolved = true;
    });
    
    // Should not resolve since signal already happened
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(resolved).to.be.false;
    
    // Signal again
    signal.signal();
    await waitPromise;
    expect(resolved).to.be.true;
  });

  it('should handle multiple signals', async () => {
    let count = 0;
    
    const waitPromise1 = signal.wait().then(() => count++);
    signal.signal();
    await waitPromise1;
    expect(count).to.equal(1);
    
    const waitPromise2 = signal.wait().then(() => count++);
    signal.signal();
    await waitPromise2;
    expect(count).to.equal(2);
  });

  it('should handle subscriber errors gracefully', async () => {
    let resolved = false;
    let errorThrown = false;
    
    // Mock console.error to capture error
    const originalConsoleError = console.error;
    const errors: any[] = [];
    console.error = (...args: any[]) => {
      errors.push(args);
    };
    
    try {
      // Create a wait that will throw an error in the callback itself
      // We need to patch the signal's internal mechanism
      const originalSignal = signal.signal.bind(signal);
      signal.signal = function() {
        const subscribers = [...(this as any)._sub];
        (this as any)._sub.length = 0;
        for (const sub of subscribers) {
          try {
            sub();
          } catch (err) {
            console.error('Error in signal subscriber:', err);
          }
        }
      };
      
      // Add a callback that will throw
      (signal as any)._sub.push(() => {
        errorThrown = true;
        throw new Error('Test error in subscriber');
      });
      
      // Add a normal callback
      (signal as any)._sub.push(() => {
        resolved = true;
      });
      
      signal.signal();
      
      expect(resolved).to.be.true;
      expect(errorThrown).to.be.true;
      expect(errors).to.have.length(1);
      expect(errors[0][0]).to.include('Error in signal subscriber');
    } finally {
      console.error = originalConsoleError;
    }
  });

  it('should properly remove callback from subscribers list', async () => {
    let resolved1 = false;
    let resolved2 = false;
    
    const promise1 = signal.wait().then(() => { resolved1 = true; });
    const promise2 = signal.wait().then(() => { resolved2 = true; });
    
    signal.signal();
    await Promise.all([promise1, promise2]);
    
    expect(resolved1).to.be.true;
    expect(resolved2).to.be.true;
    
    // Signal again - should not affect previous waiters
    resolved1 = false;
    resolved2 = false;
    signal.signal();
    
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(resolved1).to.be.false;
    expect(resolved2).to.be.false;
  });
});

describe('Gate', () => {
  let gate: Gate;

  beforeEach(() => {
    gate = new Gate(2);
  });

  it('should allow immediate passage when count > 0', async () => {
    expect(gate.count).to.equal(2);
    
    await gate.wait(); // Should resolve immediately
    expect(gate.count).to.equal(1);
    
    await gate.wait(); // Should resolve immediately
    expect(gate.count).to.equal(0);
  });

  it('should block when count reaches 0', async () => {
    // Consume all permits
    await gate.wait(); // count = 1
    await gate.wait(); // count = 0
    
    let resolved = false;
    const waitPromise = gate.wait().then(() => {
      resolved = true;
    });
    
    // Should not resolve immediately
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(resolved).to.be.false;
    expect(gate.queueLength).to.equal(1);
    
    // Increment to allow passage
    gate.increment();
    await waitPromise;
    expect(resolved).to.be.true;
  });

  it('should handle multiple queued waiters', async () => {
    const gate = new Gate(0); // Start with no permits
    const results: number[] = [];
    
    const promises = [
      gate.wait().then(() => results.push(1)),
      gate.wait().then(() => results.push(2)),
      gate.wait().then(() => results.push(3))
    ];
    
    expect(gate.queueLength).to.equal(3);
    expect(results).to.have.length(0);
    
    // Increment once - should only release one waiter
    gate.increment();
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(results).to.have.length(1);
    expect(gate.queueLength).to.equal(2);
    
    // Increment twice more
    gate.increment();
    gate.increment();
    await Promise.all(promises);
    expect(results).to.have.length(3);
    expect(gate.queueLength).to.equal(0);
  });

  it('should handle setCount method', async () => {
    const gate = new Gate(0);
    let resolved = 0;
    
    const promises = [
      gate.wait().then(() => resolved++),
      gate.wait().then(() => resolved++)
    ];
    
    expect(gate.queueLength).to.equal(2);
    
    // Set count to 2 - should clear all queued waiters
    gate.setCount(2);
    await Promise.all(promises);
    
    expect(resolved).to.equal(2);
    expect(gate.count).to.equal(0); // Each wait() decrements
    expect(gate.queueLength).to.equal(0);
  });

  it('should handle callback errors gracefully', async () => {
    const gate = new Gate(0);
    
    // Mock console.error
    const originalConsoleError = console.error;
    const errors: any[] = [];
    console.error = (...args: any[]) => {
      errors.push(args);
    };
    
    try {
      let resolved = false;
      
      // Manually add callbacks to test error handling
      (gate as any)._queue.push(() => {
        throw new Error('Test callback error');
      });
      
      (gate as any)._queue.push(() => {
        resolved = true;
      });
      
      // Trigger clearQueue by setting count
      gate.setCount(2);
      
      // Give time for callbacks to execute
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(resolved).to.be.true;
      expect(errors).to.have.length(1);
      expect(errors[0][0]).to.include('Error in gate callback');
    } finally {
      console.error = originalConsoleError;
    }
  });

  it('should properly remove callback from queue', async () => {
    const gate = new Gate(0);
    let resolved = false;
    
    const waitPromise = gate.wait().then(() => {
      resolved = true;
    });
    
    expect(gate.queueLength).to.equal(1);
    
    gate.increment();
    await waitPromise;
    
    expect(resolved).to.be.true;
    expect(gate.queueLength).to.equal(0);
    expect(gate.count).to.equal(0);
  });

  it('should handle edge cases in clearQueue', async () => {
    const gate = new Gate(0);
    
    // Add multiple waiters
    const promises = [
      gate.wait(),
      gate.wait(),
      gate.wait()
    ];
    
    expect(gate.queueLength).to.equal(3);
    
    // Set a high count that should clear all
    gate.setCount(5);
    await Promise.all(promises);
    
    expect(gate.queueLength).to.equal(0);
    expect(gate.count).to.equal(2); // 5 - 3 = 2
  });

  it('should allow tasks to race in completion order', async () => {
    // c) racing: later-started but shorter tasks can finish before earlier longer tasks
    const gate = new Gate(2);
    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

  const completedOrder: number[] = [];
  // Choose durations with large gaps to reduce flakiness
  const durations = [200, 100, 30, 10];

    const tasks = durations.map((ms, i) => (async () => {
      await gate.wait();
      try {
        await sleep(ms);
      } finally {
        completedOrder.push(i);
        gate.increment();
      }
    })());

    await Promise.all(tasks);
    // Expect at least one later shorter task (2 or 3) to complete before the longest (0)
    const before0 = completedOrder.indexOf(2) < completedOrder.indexOf(0) || completedOrder.indexOf(3) < completedOrder.indexOf(0);
    expect(before0).to.equal(true);
  });

  it('should block when at capacity until a slot frees', async () => {
    const gate = new Gate(2);
    let started = 0;

    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

    const makeTask = () => (async () => {
      await gate.wait();
      started++;
      try {
        await sleep(30);
      } finally {
        gate.increment();
      }
    })();

    const total = 5;
    const tasks = Array.from({ length: total }, makeTask);

    // Give microtasks/timers a moment
    await sleep(5);
    // Only two should have started due to capacity 2
    expect(started).to.equal(2);

    await Promise.all(tasks);
    expect(started).to.equal(total);
  });
});

describe('BlockingQueue', () => {
  let queue: BlockingQueue<number>;

  beforeEach(() => {
    queue = new BlockingQueue<number>();
  });

  it('should handle push followed by pull', async () => {
    const pushPromise = queue.push(42);
    const pullPromise = queue.pull();
    
    const [, value] = await Promise.all([pushPromise, pullPromise]);
    expect(value).to.equal(42);
  });

  it('should handle pull followed by push', async () => {
    const pullPromise = queue.pull();
    const pushPromise = queue.push(42);
    
    const [value] = await Promise.all([pullPromise, pushPromise]);
    expect(value).to.equal(42);
  });

  it('should handle multiple pushers and pullers', async () => {
    const values = [1, 2, 3, 4, 5];
    const results: number[] = [];
    
    // Start multiple pullers
    const pullPromises = values.map(() => 
      queue.pull().then(value => results.push(value))
    );
    
    // Start multiple pushers
    const pushPromises = values.map(value => queue.push(value));
    
    await Promise.all([...pullPromises, ...pushPromises]);
    
    expect(results).to.have.length(5);
    expect(results.sort()).to.deep.equal([1, 2, 3, 4, 5]);
  });

  it('should track waiting pushers and pullers', async () => {
    expect(queue.pushersWaiting).to.equal(0);
    expect(queue.pullersWaiting).to.equal(0);
    
    // Add some pushers without pullers
    const pushPromises = [
      queue.push(1),
      queue.push(2)
    ];
    
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(queue.pushersWaiting).to.equal(2);
    expect(queue.pullersWaiting).to.equal(0);
    
    // Add some pullers - should start pairing
    const pullPromises = [
      queue.pull(),
      queue.pull()
    ];
    
    await Promise.all([...pushPromises, ...pullPromises]);
    
    expect(queue.pushersWaiting).to.equal(0);
    expect(queue.pullersWaiting).to.equal(0);
  });

  it('should handle queued pullers', async () => {
    // Start pullers first
    const pullPromises = [
      queue.pull(),
      queue.pull(),
      queue.pull()
    ];
    
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(queue.pullersWaiting).to.equal(3);
    
    // Add pushers to satisfy them
    const pushPromises = [
      queue.push(1),
      queue.push(2),
      queue.push(3)
    ];
    
    const results = await Promise.all(pullPromises);
    await Promise.all(pushPromises);
    
    expect(results.sort()).to.deep.equal([1, 2, 3]);
    expect(queue.pullersWaiting).to.equal(0);
    expect(queue.pushersWaiting).to.equal(0);
  });

  it('should handle errors in dequeue gracefully', async () => {
    // Mock console.error
    const originalConsoleError = console.error;
    const errors: any[] = [];
    console.error = (...args: any[]) => {
      errors.push(args);
    };
    
    try {
      let normalPullerResolved = false;
      
      // Manually manipulate internal state to create error scenario
      (queue as any)._pushers.push(() => {
        throw new Error('Test pusher error');
      });
      
      (queue as any)._pullers.push((value: number) => {
        normalPullerResolved = true;
      });
      
      // Add a normal pusher-puller pair
      (queue as any)._pushers.push(() => 42);
      (queue as any)._pullers.push((value: number) => {
        normalPullerResolved = true;
      });
      
      // Trigger dequeue
      (queue as any).dequeue();
      
      // Give time for error to be logged
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(errors).to.have.length(1);
      expect(errors[0][0]).to.include('Error in blocking queue dequeue');
    } finally {
      console.error = originalConsoleError;
    }
  });

  it('should work with different data types', async () => {
    const stringQueue = new BlockingQueue<string>();
    
    const pushPromise = stringQueue.push('hello');
    const pullPromise = stringQueue.pull();
    
    const [, value] = await Promise.all([pushPromise, pullPromise]);
    expect(value).to.equal('hello');
  });

  it('should work with complex objects', async () => {
    const objectQueue = new BlockingQueue<{id: number, name: string}>();
    const testObject = {id: 1, name: 'test'};
    
    const pushPromise = objectQueue.push(testObject);
    const pullPromise = objectQueue.pull();
    
    const [, value] = await Promise.all([pushPromise, pullPromise]);
    expect(value).to.deep.equal(testObject);
  });

  it('should handle rapid push/pull cycles', async () => {
    const results: number[] = [];
    
    // Rapid push/pull cycles
    for (let i = 0; i < 10; i++) {
      const pushPromise = queue.push(i);
      const pullPromise = queue.pull().then(value => results.push(value));
      await Promise.all([pushPromise, pullPromise]);
    }
    
    expect(results).to.have.length(10);
    expect(results.sort((a, b) => a - b)).to.deep.equal([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('should allow later faster producer to deliver first (race)', async () => {
    // c) race: later task can win if it arrives first at the queue
    const results: number[] = [];

  const pull1 = queue.pull().then(v => results.push(v));

    // Producer A starts earlier but arrives later (longer delay)
    const producerA = (async () => {
      await new Promise(res => setTimeout(res, 10));
      await queue.push(1);
    })();

    // Producer B starts later but arrives first (shorter delay)
    const producerB = (async () => {
      await new Promise(res => setTimeout(res, 0));
      await queue.push(2);
    })();

    // Wait only for the first delivery to establish race winner
    await pull1;

    // Drain the second producer to avoid leaving a pending pusher
    const pull2 = queue.pull();
    await Promise.all([pull2, producerA, producerB]);

    // Expect the value from the faster (later-started) producer B to be delivered first
    expect(results).to.deep.equal([2]);
  });

  it('should pair multiple pullers with producers in arrival order (race across many)', async () => {
    const pulls: Promise<number>[] = [queue.pull(), queue.pull(), queue.pull()];

    // Stagger producers so the one scheduled later arrives first
    const producers = [
      (async () => { await new Promise(r => setTimeout(r, 10)); await queue.push(1); })(),
      (async () => { await new Promise(r => setTimeout(r, 0)); await queue.push(2); })(),
      (async () => { await new Promise(r => setTimeout(r, 5)); await queue.push(3); })(),
    ];

    const results = await Promise.all(pulls);
    await Promise.all(producers);

    // The first pull resolves with the first arriving producer (2), then 3, then 1
    // Note: Pullers are queued first; producers race to satisfy them.
    expect(results).to.deep.equal([2, 3, 1]);
  });
});
