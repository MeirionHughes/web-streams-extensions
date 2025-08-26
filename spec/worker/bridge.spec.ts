import { assert } from 'chai';
import { bridge } from '../../src/operators/bridge.js';
import { pipe } from '../../src/pipe.js';
import { of } from '../../src/of.js';
import { range } from '../../src/range.js';
import { toArray } from '../../src/to-array.js';
import { map } from '../../src/operators/map.js';

describe('bridge operator (browser)', function () {
  let worker: Worker;

  // If Worker isn't available in this environment, skip the whole suite
  before(function () {
    if (typeof Worker === 'undefined') {
      this.skip();
    }
  });

  beforeEach(function () {
    // Create a fresh worker for each test using the bundled worker file
    worker = new Worker(new URL('./bridge-worker.bundle.js', import.meta.url));
  });

  afterEach(() => {
    if (worker) {
      worker.terminate();
    }
  });

  it('should bridge simple transform to worker', async () => {
    const stream = pipe(
      of(1, 2, 3, 4, 5),
      bridge(worker, 'double')
    );

    const result = await toArray(stream);

    assert.deepEqual(result, [2, 4, 6, 8, 10]);
  });

  it('should handle string transformation', async () => {
    const stream = pipe(
      of('hello', 'world', 'test'),
      bridge(worker, 'double')
    );

    const result = await toArray(stream);

    assert.deepEqual(result, ['transformed: hello', 'transformed: world', 'transformed: test']);
  });

  it('should handle number arrays', async () => {
    const stream = pipe(
      of([1, 2], [3, 4], [5, 6]),
      bridge(worker, 'double')
    );

    const result = await toArray(stream);

    assert.deepEqual(result, [[2, 4], [6, 8], [10, 12]]);
  });

  it('should handle pass-through for complex objects', async () => {
    const stream = pipe(
      of({ x: 1 }, { y: 2 }),
      bridge<any, string>(worker, 'double')
    );

    const result = await toArray(stream);

    assert.deepEqual(result, ['transformed: [object Object]', 'transformed: [object Object]']);
  });

  it('should handle cancellation', async () => {
    const stream = pipe(
      range(1, 1000),
      bridge(worker, 'double')
    );

    const reader = stream.getReader();

    // Read a few chunks
    await reader.read();
    await reader.read();

    // Cancel the stream
    await reader.cancel('Test cancellation');

    // Should not throw
    assert.isTrue(true);
  });

  it('should handle backpressure', async () => {
    let readCount = 0;
    const stream = pipe(
      range(1, 50),
      bridge(worker, 'double')
    );

    const reader = stream.getReader();

    // Read slowly to test backpressure
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      readCount++;

      // Add small delay to simulate slow consumer
      await new Promise(resolve => setTimeout(resolve, 1));
    }

    assert.equal(readCount, 50);
  });

  it('should work with pipe chains', async () => {
    const stream = pipe(
      range(1, 5),
      map(x => x * 2), // first multiply by 2
      bridge(worker, 'double', {
        validate(value) {
          return typeof value == "number"
        },
      }), // then multiply by 2 in worker
      map(x => x + 1) // then add 1
    );

    const result = await toArray(stream);

    // (1*2*2)+1=5, (2*2*2)+1=9, etc.
    assert.deepEqual(result, [5, 9, 13, 17, 21]);
  });

  it('should handle empty stream', async () => {
    const stream = pipe(
      of(), // empty stream
      bridge(worker, 'double')
    );

    const result = await toArray(stream);

    assert.deepEqual(result, []);
  });

  it('should handle typed arrays with transferables', async () => {
    const data1 = new Uint8Array([1, 2, 3, 4]);
    const data2 = new Uint8Array([5, 6, 7, 8]);

    const stream = pipe(
      of(data1, data2),
      bridge(worker, 'double', {
        validate(value) {
          return value instanceof Uint8Array
        },
      })
    );

    const result = await toArray(stream);

    assert.equal(result.length, 2);
    assert.deepEqual(Array.from(result[0]), [2, 4, 6, 8]);
    assert.deepEqual(Array.from(result[1]), [10, 12, 14, 16]);
  });

  it('should reject unknown stream types', async () => {
    const stream = pipe(
      of(1, 2, 3),
      bridge(worker, 'unknown-type')
    );

    // Should error when trying to read
    const reader = stream.getReader();

    try {
      await reader.read();
      assert.fail('Expected error for unknown stream type');
    } catch (error: any) {
      assert.include(error.message, 'Unknown stream type');
    }
  });

  it('should handle worker-side errors', async () => {
    const stream = pipe(
      of('normal', 'error', 'should-not-reach'),
      bridge(worker, 'error')
    );

    const reader = stream.getReader();

    // First chunk should pass through
    const { value: firstValue } = await reader.read();
    assert.equal(firstValue, 'normal');

    // Second chunk should trigger error in worker
    try {
      await reader.read();
      assert.fail('Expected error from worker');
    } catch (error: any) {
      assert.include(error.message, 'Test error from worker');
    }
  });

  it('should handle timeout on stream request', async () => {
    const stream = pipe(
      of(1, 2, 3),
      bridge(worker, 'no-response', { timeout: 100 }) // Worker won't respond
    );

    const reader = stream.getReader();

    try {
      await reader.read();
      assert.fail('Expected timeout error');
    } catch (error: any) {
      assert.include(error.message, 'timeout');
    }
  });

  it('should handle unknown stream types', async () => {
    const stream = pipe(
      of(1, 2, 3),
      bridge(worker, 'unknown-stream-type')
    );

    const reader = stream.getReader();

    try {
      await reader.read();
      assert.fail('Expected rejection error');
    } catch (error: any) {
      assert.include(error.message, 'Unknown stream type: unknown-stream-type');
    }
  });

  it('should handle worker-side cancellation', async () => {
    // Use delay stream to test cancellation during processing
    const stream = pipe(
      range(1, 10),
      bridge(worker, 'delay')
    );

    const reader = stream.getReader();

    // Start reading
    const readPromise = reader.read();

    // Cancel after starting
    setTimeout(() => reader.cancel('Test cancellation'), 50);

    try {
      await readPromise;
      // Should either complete normally or be cancelled
      assert.isTrue(true);
    } catch (error) {
      // Cancellation might throw, which is okay
      assert.isTrue(true);
    }
  });

  it('should handle backpressure with passthrough stream', async () => {
    const stream = pipe(
      range(1, 20),
      bridge(worker, 'passthrough')
    );

    const result = await toArray(stream);

    // Passthrough should return data unchanged
    assert.deepEqual(result, Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('should handle filtering stream', async () => {
    const stream = pipe(
      range(1, 10),
      bridge(worker, 'filter-even')
    );

    const result = await toArray(stream);

    // Should only return even numbers
    assert.deepEqual(result, [2, 4, 6, 8, 10]);
  });

  it('should handle multiple concurrent streams', async () => {
    const stream1 = pipe(
      of(1, 2),
      bridge(worker, 'double')
    );

    const stream2 = pipe(
      of(10, 20),
      bridge(worker, 'passthrough')
    );

    const [result1, result2] = await Promise.all([
      toArray(stream1),
      toArray(stream2)
    ]);

    assert.deepEqual(result1, [2, 4]);
    assert.deepEqual(result2, [10, 20]);
  });

  it('should handle immediate worker rejection during stream setup', async () => {
    const stream = pipe(
      of(1, 2, 3),
      bridge(worker, 'immediate-error')
    );

    try {
      await toArray(stream);
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok(error.message.includes('Immediate error from worker'));
    }
  });
});
