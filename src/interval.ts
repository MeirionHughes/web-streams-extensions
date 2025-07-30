/**
 * Creates a ReadableStream that emits incremental numbers at specified intervals.
 * 
 * @param duration Interval duration in milliseconds
 * @returns A ReadableStream that emits numbers (0, 1, 2, ...) at regular intervals
 * 
 * @example
 * ```typescript
 * let stream = pipe(
 *   interval(1000),
 *   take(5)
 * );
 * // Emits: 0, 1, 2, 3, 4 (one per second)
 * ```
 */
export function interval(duration: number): ReadableStream<number> {
    if (duration <= 0) {
        throw new Error("Interval duration must be positive");
    }
    
    let count = 0;
    let timer: ReturnType<typeof setInterval> | null = null;

    return new ReadableStream<number>({
        async start(controller) {
            timer = setInterval(() => {
                try {
                    controller.enqueue(count++);
                } catch (err) {
                    // Controller might be closed, clear timer
                    if (timer) {
                        clearInterval(timer);
                        timer = null;
                    }
                }
            }, duration);
        },
        async cancel() {
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
        }
    });
}