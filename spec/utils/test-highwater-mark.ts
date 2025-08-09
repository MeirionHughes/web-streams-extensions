import { expect } from "chai";
import { Op, pipe, range, tap, UnaryFunction } from '../../src/index.js';

/**
 * Utility function to compare highWaterMark behavior between two different values.
 * Verifies that a higher highWaterMark results in more pulls than a lower one.
 * 
 * Note: Exact pull counts are difficult to predict due to multiple layers of internal 
 * buffering, so this utility focuses on relative behavior rather than absolute numbers.
 * 
 * @param operatorFactory - Function that creates the operator with highWaterMark option
 * @param lowHighWaterMark - The lower highWaterMark value to test
 * @param highHighWaterMark - The higher highWaterMark value to test
 * @param sourceSize - Number of items in the source stream (default: 100)
 * @param waitTime - How long to wait for backpressure to take effect (default: 100ms)
 * @returns Promise<{ low: number, high: number }> - The pull counts for both tests
 * @example Usage with buffer operator:
 * ```typescript
 * const result = await compareHighWaterMarkBehavior(
 *   buffer(2),
 *   4,   // low highWaterMark
 *   16   // high highWaterMark
 * );
 * 
 * // Focus on relative behavior rather than exact numbers
 * expect(result.high).to.be.greaterThan(result.low * 2);
 * expect(result.low).to.be.at.least(4);
 * expect(result.high).to.be.at.least(15);
 * ```
 */
export async function compareHighWaterMarkBehavior<R>(
  operatorFactory: UnaryFunction<ReadableStream<number>, ReadableStream<R>>,
  lowHighWaterMark: number,
  highHighWaterMark: number,
  sourceSize: number = 100,
  waitTime: number = 100
): Promise<{ low: number, high: number }> {
  // Test with lower highWaterMark
  let pullCountLow = 0;
  let srcLow = pipe(range(0, sourceSize), tap(_ => pullCountLow++), { highWaterMark: 1 });
  let operatedStreamLow = operatorFactory(srcLow, { highWaterMark: lowHighWaterMark });
  
  let blockingWritableLow = new WritableStream({
    write(chunk) {
      return new Promise(() => {}); // Never resolves
    }
  });
  
  let pipePromiseLow = operatedStreamLow.pipeTo(blockingWritableLow);
  await new Promise(resolve => setTimeout(resolve, waitTime));
  
  // Test with higher highWaterMark
  let pullCountHigh = 0;
  let srcHigh = pipe(range(0, sourceSize), tap(_ => pullCountHigh++), { highWaterMark: 1 });
  let operatedStreamHigh = operatorFactory(srcHigh, { highWaterMark: highHighWaterMark });
  
  let blockingWritableHigh = new WritableStream({
    write(chunk) {
      return new Promise(() => {}); // Never resolves
    }
  });
  
  let pipePromiseHigh = operatedStreamHigh.pipeTo(blockingWritableHigh);

  await new Promise(resolve => setTimeout(resolve, waitTime));
  
  // The stream with higher highWaterMark should pull more items
  expect(pullCountHigh).to.be.greaterThan(pullCountLow,
    `Higher highWaterMark (${highHighWaterMark}) should pull more items than lower (${lowHighWaterMark}). ` +
    `Got ${pullCountHigh} vs ${pullCountLow}`);
  
  // Clean up
  try {
    await blockingWritableLow.abort("Test cleanup");
    await blockingWritableHigh.abort("Test cleanup");
  } catch {
    // Expected - the pipes will be aborted
  }

  // the source pipe itself will also have internal buffering on src pipes
  // that will affect the overall pull count - approximately 3 extra buffers (pulls)
  let testingPullsExpectedLow = 3;
  let testingPullsExpectedHigh = 3;

  return { low: pullCountLow - testingPullsExpectedLow, high: pullCountHigh - testingPullsExpectedHigh };
}
