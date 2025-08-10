/**
 * Combines multiple ReadableStreams by emitting an array of the latest values from each source
 * whenever any source emits. All sources must emit at least once before any combined value is emitted.
 * Completes when ALL sources complete (RxJS behavior).
 * 
 * @template T The types of values from each source stream
 * @param sources The streams to combine
 * @returns A ReadableStream that emits arrays of the latest values
 * 
 * @example
 * ```typescript
 * // Basic combine latest
 * const numbers = from([1, 2, 3]);
 * const letters = from(['a', 'b']);
 * const combined = combineLatest(numbers, letters);
 * // Emits: [1, 'a'], [2, 'a'], [2, 'b'], [3, 'b']
 * // Completes when both streams complete
 * 
 * // With different timing - continues until ALL complete
 * const fast = from([1, 2, 3, 4]);
 * const slow = from(['a']);
 * const combined = combineLatest(fast, slow);
 * // Emits: [1, 'a'], [2, 'a'], [3, 'a'], [4, 'a']
 * // Waits for both to complete (RxJS behavior)
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

  return new ReadableStream<any[]>({
    async start(controller) {
      let readers: ReadableStreamDefaultReader<any>[] = [];
      const latestValues: any[] = new Array(streams.length);
      const hasValues: boolean[] = new Array(streams.length).fill(false);
      const completedStreams: boolean[] = new Array(streams.length).fill(false);
      let allHaveEmitted = false;
      let isClosed = false;

      // Helper to safely emit a combination
      const emitCombination = () => {
        if (!isClosed && allHaveEmitted) {
          try {
            controller.enqueue([...latestValues]);
          } catch (err) {
            // Controller might be closed due to race condition
            isClosed = true;
          }
        }
      };

      // Helper to check if we should complete
      const checkCompletion = () => {
        // Only complete when ALL streams have completed (RxJS behavior)
        if (!isClosed && completedStreams.every(completed => completed)) {
          try {
            controller.close();
            isClosed = true;
          } catch (err) {
            // Already closed
            isClosed = true;
          }
        }
      };

      try {
        // Create readers for all streams
        readers = streams.map(stream => stream.getReader());

        // Start independent workers for each stream
        const workers = streams.map(async (_, index) => {
          try {
            while (!completedStreams[index] && !isClosed) {
              const { done, value } = await readers[index].read();
              
              if (done) {
                completedStreams[index] = true;
                checkCompletion();
                break;
              }

              // Update latest value for this stream
              latestValues[index] = value;
              hasValues[index] = true;
              
              // Check if all streams have emitted at least once
              if (!allHaveEmitted && hasValues.every(has => has)) {
                allHaveEmitted = true;
              }
              
              // Emit combination if all streams have emitted
              emitCombination();
            }
          } catch (err) {
            if (!isClosed) {
              controller.error(err);
              isClosed = true;
            }
          }
        });

        // Wait for all workers to complete, but don't block the controller
        Promise.all(workers).catch(err => {
          if (!isClosed) {
            controller.error(err);
            isClosed = true;
          }
        });

      } catch (err) {
        controller.error(err);
        isClosed = true;
      }

      // Store readers reference for cleanup
      (controller as any)._readers = readers;
    },
    
    cancel() {
      // Clean up all readers
      const readers = ((this as any)._readers || []) as ReadableStreamDefaultReader<any>[];
      readers.forEach((reader) => {
        try {
          if (reader) {
            reader.cancel();
            reader.releaseLock();
          }
        } catch (err) {
          // Reader might already be released
        }
      });
    }
  });
}
