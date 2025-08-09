/**
 * Interface for schedulers that control the timing of stream operations.
 * Schedulers can be used to control when stream chunks are processed,
 * enabling features like throttling, debouncing, or yielding control.
 */
export interface IScheduler {
    /**
     * Schedules a callback to be executed at the scheduler's determined time.
     * This allows the scheduler to control the exact timing and execution context
     * of stream processing without being forced into the microtask queue.
     * 
     * @param callback The function to execute when the scheduler determines it's time
     * 
     * @example
     * ```typescript
     * // Direct control over execution timing
     * scheduler.schedule(() => {
     *   // This runs exactly when the scheduler wants it to
     * });
     * ```
     */
    schedule(callback: () => void): void;
}