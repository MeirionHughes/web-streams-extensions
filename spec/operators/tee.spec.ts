import { assert, expect } from 'chai';
import { from, toArray, pipe, tee, take, delay } from '../../src/index.js';

describe('tee operator', () => {

  it('throws for invalid counts', () => {
    expect(() => tee(0)).to.throw();
    expect(() => tee(-1)).to.throw();
  });

  it('should return the original stream for one tee case', async () => {
    const src = from([1, 2, 3]);
    const [src2] = tee<number>(1)(src);

    expect(src).to.equal(src2);
  });

  it('should split into two identical streams', async () => {
    const src = from([1, 2, 3]);
    const [a, b] = tee<number>(2)(src);

    const ra = await toArray(a);
    const rb = await toArray(b);

    expect(ra).to.deep.equal([1, 2, 3]);
    expect(rb).to.deep.equal([1, 2, 3]);
  });

  it('should split into three identical streams', async () => {
    const src = from([10, 20]);
    const [a, b, c] = tee<number>(3)(src);
    expect(await toArray(a)).to.deep.equal([10, 20]);
    expect(await toArray(b)).to.deep.equal([10, 20]);
    expect(await toArray(c)).to.deep.equal([10, 20]);
  });

  it('block policy prevents further reads when a branch is slow', async () => {
    let readCount = 0;
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    const src = new ReadableStream<number>({
      pull(controller) {
        readCount++;
        const v = values.shift();
        if (v !== undefined) controller.enqueue(v);
        else controller.close();
      }
    }, { highWaterMark: 0 });

    const [a, b] = tee<number>(2, { overflow: 'block' })(src, { highWaterMark: 1 } as any);

    const ra = a.getReader();
    const rb = b.getReader();

    // read first item from both branches - should succeed
    const r1a = await ra.read();
    const r1b = await rb.read();

    expect(r1a.value).to.equal(1);
    expect(r1b.value).to.equal(1);
    expect(readCount).to.be.at.most(2); // Only 1 read due to proper blocking, but might be 2 on browsers

    // read second item from branch a - should succeed since branch b consumed its buffer
    const r2a = await ra.read();
    expect(r2a.value).to.equal(2);
    expect(readCount).to.be.at.most(2);

    // third read should be blocked (since branch b hasn't consumed second item and HWM==1)
    const timeout = (ms: number) => new Promise(resolve => setTimeout(() => resolve('t'), ms));
    const res = await Promise.race([ra.read(), timeout(20)]);
    expect(res).to.equal('t');

    // cleanup
    await ra.cancel();
    await rb.cancel();
  });

  it('block policy prevents reading when a branch is at highWaterMark', async () => {
    // custom source that counts reads
    let values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    let readCount = 0;
    const src = new ReadableStream<number>({
      pull(controller) {
        readCount++;
        const v = values.shift();
        if (v !== undefined) controller.enqueue(v);
        else controller.close();
      }
    }, {highWaterMark: 0});

    const [fast, slow] = tee<number>(2, { overflow: 'block' })(src, { highWaterMark: 1 });

    // Fast consumer: fully drain
    const fastPromise = toArray(pipe(fast, take(10)));

    // Slow consumer: wait briefly before starting to consume to simulate late consumer
    await new Promise(res => setTimeout(res, 100));

    // Because slow consumer started late and highWaterMark is 1 with block policy,
    // readCount should not have aggressively read entire source before slow started.
    // allow some scheduling variance but ensure it did not eagerly read entire source
    expect(readCount).to.be.eq(1); // Only 1 read due to proper blocking without double buffering

    const slowPromise = toArray(pipe(slow, take(10)));

    const fastResult = await fastPromise;
    const slowResult = await slowPromise;

    expect(fastResult).to.deep.equal(slowResult);

    expect(readCount).to.be.eq(11); //  due to readable buffering before close

  });

  it('throw policy throws error when buffer limit is exceeded', async () => {
    let readCount = 0;
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    const src = new ReadableStream<number>({
      pull(controller) {
        readCount++;
        const v = values.shift();
        if (v !== undefined) controller.enqueue(v);
        else controller.close();
      }
    }, { highWaterMark: 0 });

    const [fast, slow] = tee<number>(2, { overflow: 'throw' })(src, { highWaterMark: 1 } as any);

    const fastReader = fast.getReader();
    
    // Read first item from fast branch to trigger first source read
    const r1fast = await fastReader.read();
    expect(r1fast.value).to.equal(1);

    // Read second item from fast branch - this should trigger second source read 
    // and fill slow branch's buffer to capacity (highWaterMark: 1)
    const r2fast = await fastReader.read();
    expect(r2fast.value).to.equal(2);

    // At this point slow branch should have items 1 and 2 queued, exceeding its highWaterMark of 1
    // When overflow occurs, ALL branches should be errored and source should be cancelled
    const slowReader = slow.getReader();
    
    // Both readers should now be in error state
    try {
      await slowReader.read();
      assert.fail('Expected slow branch to be in error state due to overflow');
    } catch (error) {
      expect(error.message).to.include('Queue overflow');
    }

    try {
      await fastReader.read();
      assert.fail('Expected fast branch to also be in error state when overflow occurs');
    } catch (error) {
      expect(error.message).to.include('Queue overflow');
    }
  });

  it('throw policy cancels source stream when overflow occurs', async () => {
    let sourceCancelled = false;
    let cancelReason = '';
    const values = [1, 2, 3, 4, 5];

    const src = new ReadableStream<number>({
      pull(controller) {
        const v = values.shift();
        if (v !== undefined) controller.enqueue(v);
        else controller.close();
      },
      cancel(reason) {
        sourceCancelled = true;
        cancelReason = reason;
      }
    }, { highWaterMark: 0 });

    const [fast, slow] = tee<number>(2, { overflow: 'throw' })(src, { highWaterMark: 1 } as any);

    const fastReader = fast.getReader();
    
    // Read items to trigger overflow
    await fastReader.read(); // Read 1
    await fastReader.read(); // Read 2, should cause overflow on slow branch

    // Give time for the error propagation to happen
    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify source was cancelled
    expect(sourceCancelled).to.be.true;
    expect(cancelReason).to.include('Queue overflow');
  });

  it('single branch cancellation does not cancel source or affect other branches', async () => {
    let sourceCancelled = false;
    const values = [1, 2, 3, 4, 5];

    const src = new ReadableStream<number>({
      pull(controller) {
        const v = values.shift();
        if (v !== undefined) controller.enqueue(v);
        else controller.close();
      },
      cancel() {
        sourceCancelled = true;
      }
    });

    const [branchA, branchB, branchC] = tee<number>(3)(src);

    const readerA = branchA.getReader();
    const readerB = branchB.getReader();
    const readerC = branchC.getReader();

    // Read from all branches to ensure they're active
    const r1a = await readerA.read();
    const r1b = await readerB.read();
    const r1c = await readerC.read();

    expect(r1a.value).to.equal(1);
    expect(r1b.value).to.equal(1);
    expect(r1c.value).to.equal(1);

    // Cancel only branch A
    await readerA.cancel('test cancellation');

    // Give time for any potential side effects
    await new Promise(resolve => setTimeout(resolve, 10));

    // Source should NOT be cancelled
    expect(sourceCancelled).to.be.false;

    // Other branches should still work
    const r2b = await readerB.read();
    const r2c = await readerC.read();

    expect(r2b.value).to.equal(2);
    expect(r2c.value).to.equal(2);

    // Clean up remaining readers
    await readerB.cancel();
    await readerC.cancel();
  });

  it('all branches cancellation does cancel source', async () => {
    let sourceCancelled = false;
    let cancelReason = '';
    const values = [1, 2, 3, 4, 5];

    const src = new ReadableStream<number>({
      pull(controller) {
        const v = values.shift();
        if (v !== undefined) controller.enqueue(v);
        else controller.close();
      },
      cancel(reason) {
        sourceCancelled = true;
        cancelReason = reason;
      }
    });

    const [branchA, branchB] = tee<number>(2)(src);

    const readerA = branchA.getReader();
    const readerB = branchB.getReader();

    // Read from both branches to ensure they're active
    await readerA.read();
    await readerB.read();

    // Cancel first branch - source should NOT be cancelled yet
    await readerA.cancel('first cancel');
    expect(sourceCancelled).to.be.false;

    // Cancel second (last) branch - source SHOULD be cancelled now
    await readerB.cancel('second cancel');
    
    // Give time for the cancellation to propagate
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(sourceCancelled).to.be.true;
    expect(cancelReason).to.equal('second cancel'); // Should use the reason from the last cancellation
  });

  it('multiple branches cancellation in sequence works correctly', async () => {
    let sourceCancelled = false;
    let cancelReason = '';
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    const src = new ReadableStream<number>({
      pull(controller) {
        const v = values.shift();
        if (v !== undefined) controller.enqueue(v);
        else controller.close();
      },
      cancel(reason) {
        sourceCancelled = true;
        cancelReason = reason;
      }
    });

    const [branchA, branchB, branchC, branchD] = tee<number>(4)(src);

    const readerA = branchA.getReader();
    const readerB = branchB.getReader();
    const readerC = branchC.getReader();
    const readerD = branchD.getReader();

    // Read from all branches to ensure they're active
    await Promise.all([
      readerA.read(),
      readerB.read(), 
      readerC.read(),
      readerD.read()
    ]);

    // Cancel branches one by one - source should only be cancelled when the last one is cancelled
    await readerB.cancel('cancel B');
    expect(sourceCancelled).to.be.false;

    await readerD.cancel('cancel D');  
    expect(sourceCancelled).to.be.false;

    await readerA.cancel('cancel A');
    expect(sourceCancelled).to.be.false;

    // Cancel the last branch - now source should be cancelled
    await readerC.cancel('cancel C - last one');
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(sourceCancelled).to.be.true;
    expect(cancelReason).to.equal('cancel C - last one');
  });
});
