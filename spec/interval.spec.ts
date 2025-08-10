import { expect } from 'chai';
import { interval } from '../src/interval.js';
import { take } from '../src/operators/take.js';
import { pipe } from '../src/pipe.js';
import { from } from '../src/from.js';
import { toArray } from '../src/to-array.js';
import { sleep } from '../src/utils/sleep.js';

describe('interval', () => {
    it('should emit incremental numbers at specified intervals', async () => {
        const stream = pipe(
            interval(10), // Use smaller interval for faster test
            take(3)
        );

        const result = await toArray(stream);
        expect(result).to.deep.equal([0, 1, 2]);
    });

    it('should start counting from 0', async () => {
        const stream = pipe(
            interval(10), // Use smaller interval for faster test
            take(1)
        );

        const result = await toArray(stream);
        expect(result).to.deep.equal([0]);
    });

    it('should throw error for zero duration', () => {
        expect(() => interval(0)).to.throw('Interval duration must be positive');
    });

    it('should throw error for negative duration', () => {
        expect(() => interval(-100)).to.throw('Interval duration must be positive');
    });

    it('should handle cancellation properly', async () => {
        const stream = interval(10);
        const reader = stream.getReader();
        
        // Read first value
        const result1 = await reader.read();
        expect(result1.value).to.equal(0);
        
        // Cancel the stream
        await reader.cancel();
        
        // Stream should be cancelled
        const result2 = await reader.read();
        expect(result2.done).to.be.true;
    });

    it('should continue emitting values until cancelled', async () => {
        const stream = pipe(
            interval(10), // Use smaller interval for faster test
            take(5)
        );
        
        const result = await toArray(stream);
        expect(result).to.deep.equal([0, 1, 2, 3, 4]);
    });

    it('should handle very small intervals', async () => {
        const stream = pipe(
            interval(1),
            take(2)
        );

        const result = await toArray(stream);
        expect(result).to.deep.equal([0, 1]);
    });

    it('should handle controller errors gracefully', async () => {
        const stream = interval(10);
        const reader = stream.getReader();
        
        // Read first value to start the timer
        const result1 = await reader.read();
        expect(result1.value).to.equal(0);
        
        // Immediately close the reader which should trigger error handling
        reader.releaseLock();
        
        // Should not throw errors
        await sleep(20); // Use deterministic sleep instead of setTimeout
    });

    it('should work with different interval durations deterministically', async () => {
        // Test that different durations produce the same sequence, just faster/slower
        const stream1 = pipe(interval(5), take(3));
        const stream2 = pipe(interval(10), take(3));
        
        const [result1, result2] = await Promise.all([
            toArray(stream1),
            toArray(stream2)
        ]);
        
        // Both should produce the same sequence
        expect(result1).to.deep.equal([0, 1, 2]);
        expect(result2).to.deep.equal([0, 1, 2]);
    });

    it('should handle multiple readers on same interval stream', async () => {
        const stream = interval(10);
        
        const reader1 = stream.getReader();
        
        // First reader should work
        const result1 = await reader1.read();
        expect(result1.value).to.equal(0);
        
        reader1.releaseLock();
        
        // Second reader should get the same stream (but it's already started)
        const reader2 = stream.getReader();
        await reader2.cancel();
    });

    it('should handle controller enqueue error when stream is cancelled', async () => {
        // This test specifically targets the catch block in the interval callback
        const stream = interval(1); // Very short interval
        const reader = stream.getReader();
        
        // Get the first value to start the interval timer
        const first = await reader.read();
        expect(first.value).to.equal(0);
        expect(first.done).to.be.false;
        
        // Cancel the reader to close the controller
        await reader.cancel();
        
        // Wait for the interval timer to fire and hit the error condition
        await sleep(5); // Use deterministic sleep instead of setTimeout
        
        // Verify the stream handled the error gracefully (stream should be done)
        const result = await reader.read();
        expect(result.done).to.be.true;
    });
});
