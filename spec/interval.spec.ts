import { expect } from 'chai';
import { interval } from '../src/interval.js';
import { take } from '../src/operators/take.js';
import { pipe } from '../src/pipe.js';

describe('interval', () => {
    it('should emit incremental numbers at specified intervals', async () => {
        const stream = pipe(
            interval(50),
            take(3)
        );

        const reader = stream.getReader();
        const start = Date.now();
        
        const results = [];
        let result = await reader.read();
        while (!result.done) {
            results.push(result.value);
            result = await reader.read();
        }

        expect(results).to.deep.equal([0, 1, 2]);
        const elapsed = Date.now() - start;
        // Should take approximately 100ms (2 intervals of 50ms)
        expect(elapsed).to.be.greaterThan(90);
        expect(elapsed).to.be.lessThan(200);
    });

    it('should start counting from 0', async () => {
        const stream = pipe(
            interval(25),
            take(1)
        );

        const reader = stream.getReader();
        const result = await reader.read();
        
        expect(result.done).to.be.false;
        expect(result.value).to.equal(0);
        
        reader.cancel();
    });

    it('should throw error for zero duration', () => {
        expect(() => interval(0)).to.throw('Interval duration must be positive');
    });

    it('should throw error for negative duration', () => {
        expect(() => interval(-100)).to.throw('Interval duration must be positive');
    });

    it('should handle cancellation properly', async () => {
        const stream = interval(25);
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
        const stream = interval(25);
        const reader = stream.getReader();
        
        // Collect several values
        const values = [];
        for (let i = 0; i < 5; i++) {
            const result = await reader.read();
            values.push(result.value);
        }
        
        expect(values).to.deep.equal([0, 1, 2, 3, 4]);
        
        await reader.cancel();
    });

    it('should handle very small intervals', async () => {
        const stream = pipe(
            interval(1),
            take(2)
        );

        const reader = stream.getReader();
        const results = [];
        
        let result = await reader.read();
        while (!result.done) {
            results.push(result.value);
            result = await reader.read();
        }

        expect(results).to.deep.equal([0, 1]);
    });

    it('should handle controller errors gracefully', async () => {
        const stream = interval(25);
        const reader = stream.getReader();
        
        // Read first value to start the timer
        const result1 = await reader.read();
        expect(result1.value).to.equal(0);
        
        // Immediately close the reader which should trigger error handling
        reader.releaseLock();
        
        // Should not throw errors
        await new Promise(resolve => setTimeout(resolve, 50));
    });

    it('should work with different interval durations', async () => {
        const stream1 = pipe(interval(30), take(2));
        const stream2 = pipe(interval(100), take(2));
        
        const start = Date.now();
        
        // Start both streams
        const reader1 = stream1.getReader();
        const reader2 = stream2.getReader();
        
        // Stream1 should complete faster
        const results1 = [];
        let result1 = await reader1.read();
        while (!result1.done) {
            results1.push(result1.value);
            result1 = await reader1.read();
        }
        
        const midTime = Date.now();
        
        const results2 = [];
        let result2 = await reader2.read();
        while (!result2.done) {
            results2.push(result2.value);
            result2 = await reader2.read();
        }
        
        const endTime = Date.now();
        
        expect(results1).to.deep.equal([0, 1]);
        expect(results2).to.deep.equal([0, 1]);
        
        // First stream should complete much faster
        expect(midTime - start).to.be.lessThan(endTime - midTime);
    });

    it('should handle multiple readers on same interval stream', async () => {
        const stream = interval(30);
        
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
        // This test specifically targets the catch block in the interval callback (lines 30-35)
        const stream = interval(1); // Very short interval
        const reader = stream.getReader();
        
        // Get the first value to start the interval timer
        const first = await reader.read();
        expect(first.value).to.equal(0);
        expect(first.done).to.be.false;
        
        // Cancel the reader to close the controller
        await reader.cancel();
        
        // Wait for the interval timer to fire and hit the error condition
        await new Promise(resolve => setTimeout(resolve, 5));
        
        // Verify the stream handled the error gracefully (stream should be done)
        const result = await reader.read();
        expect(result.done).to.be.true;
    });
});
