/**
 * Interface for schedulers that control the timing of stream operations.
 * Schedulers can be used to control when stream chunks are processed,
 * enabling features like throttling, debouncing, or yielding control.
 */
export interface IScheduler {
    /**
     * Returns a promise that resolves when the next tick should occur.
     * This allows the scheduler to control the timing of stream processing.
     * 
     * @returns A promise that resolves when the next operation should proceed
     */
    nextTick(): Promise<unknown>;
}