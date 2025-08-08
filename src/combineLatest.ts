/**
 * Combines multiple ReadableStreams by emitting an array of the latest values from each source
 * whenever any source emits. All sources must emit at least once before any combined value is emitted.
 * Completes when all sources complete.
 * 
 * @template T The types of values from each source stream
 * @param sources The streams to combine
 * @returns A ReadableStream that emits arrays of the latest values
 * 
 * @example
 * ```typescript
 * // Basic combine latest
 * const numbers = from([1, 2, 3]);
 * const letters = from(['a', 'b', 'c']);
 * const combined = combineLatest(numbers, letters);
 * // Emits: [1, 'a'], [2, 'a'], [2, 'b'], [3, 'b'], [3, 'c']
 * 
 * // With different timing
 * const fast = interval(100);
 * const slow = interval(300);
 * const combined = combineLatest(fast, slow);
 * // Emits arrays with latest from each stream when either emits
 * ```
 */

// Two streams
export function combineLatest<A, B>(
  sourceA: ReadableStream<A>,
  sourceB: ReadableStream<B>
): ReadableStream<[A, B]>;

// Three streams
export function combineLatest<A, B, C>(
  sourceA: ReadableStream<A>,
  sourceB: ReadableStream<B>,
  sourceC: ReadableStream<C>
): ReadableStream<[A, B, C]>;

// Four streams
export function combineLatest<A, B, C, D>(
  sourceA: ReadableStream<A>,
  sourceB: ReadableStream<B>,
  sourceC: ReadableStream<C>,
  sourceD: ReadableStream<D>
): ReadableStream<[A, B, C, D]>;

// Array of homogeneous streams
export function combineLatest<T>(sources: ReadableStream<T>[]): ReadableStream<T[]>;

// Implementation
export function combineLatest(...sources: ReadableStream<any>[] | [ReadableStream<any>[]]): ReadableStream<any[]> {
  // Handle array format
  const streams = Array.isArray(sources[0]) ? sources[0] : sources;
  
  if (streams.length === 0) {
    throw new Error("combineLatest requires at least one source stream");
  }

  let readers: ReadableStreamDefaultReader<any>[] = [];
  let latestValues: any[] = new Array(streams.length);
  let hasValues: boolean[] = new Array(streams.length).fill(false);
  let completedStreams: boolean[] = new Array(streams.length).fill(false);
  let allHaveEmitted = false;

  return new ReadableStream<any[]>({
    async start(controller) {
      readers = streams.map(stream => stream.getReader());
      
      // Read from each stream independently
      streams.forEach(async (_, index) => {
        try {
          while (!completedStreams[index]) {
            const { done, value } = await readers[index].read();
            
            if (done) {
              completedStreams[index] = true;
              
              // If any stream completes, the combined stream should complete
              if (completedStreams.some(completed => completed)) {
                controller.close();
              }
              break;
            }

            // Update latest value for this stream
            latestValues[index] = value;
            hasValues[index] = true;
            
            // Check if all streams have emitted at least once
            if (!allHaveEmitted && hasValues.every(has => has)) {
              allHaveEmitted = true;
            }
            
            // Emit combined value if all streams have emitted
            if (allHaveEmitted) {
              try {
                controller.enqueue([...latestValues]);
              } catch (err) {
                // Controller might be closed
                break;
              }
            }
          }
        } catch (err) {
          controller.error(err);
        }
      });
    },
    cancel() {
      readers.forEach(reader => {
        if (reader) {
          reader.cancel();
          reader.releaseLock();
        }
      });
      readers = [];
    }
  });
}
