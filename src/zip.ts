
/**
 * Combines multiple ReadableStreams by emitting an array/tuple of the latest values from each source
 * when all sources have emitted. Completes when any source completes.
 * 
 * @example
 * ```typescript
 * // Basic zip - returns tuples
 * const numbers = from([1, 2, 3]);
 * const letters = from(['a', 'b', 'c']);
 * const zipped = zip(numbers, letters);
 * // Emits: [1, 'a'], [2, 'b'], [3, 'c']
 * 
 * // With selector function
 * const combined = zip(numbers, letters, (n, l) => `${n}${l}`);
 * // Emits: "1a", "2b", "3c"
 * 
 * // Three streams
 * const symbols = from(['!', '?', '.']);
 * const tripleZip = zip(numbers, letters, symbols);
 * // Emits: [1, 'a', '!'], [2, 'b', '?'], [3, 'c', '.']
 * ```
 */

// 2 streams without selector - returns tuple
export function zip<A, B>(
  sourceA: ReadableStream<A>, 
  sourceB: ReadableStream<B>
): ReadableStream<[A, B]>;

// 2 streams with selector
export function zip<A, B, R>(
  sourceA: ReadableStream<A>, 
  sourceB: ReadableStream<B>,
  selector: (a: A, b: B) => R
): ReadableStream<R>;

// 3 streams without selector - returns tuple
export function zip<A, B, C>(
  sourceA: ReadableStream<A>, 
  sourceB: ReadableStream<B>,
  sourceC: ReadableStream<C>
): ReadableStream<[A, B, C]>;

// 3 streams with selector
export function zip<A, B, C, R>(
  sourceA: ReadableStream<A>, 
  sourceB: ReadableStream<B>,
  sourceC: ReadableStream<C>,
  selector: (a: A, b: B, c: C) => R
): ReadableStream<R>;

// 4 streams without selector - returns tuple
export function zip<A, B, C, D>(
  sourceA: ReadableStream<A>, 
  sourceB: ReadableStream<B>,
  sourceC: ReadableStream<C>,
  sourceD: ReadableStream<D>
): ReadableStream<[A, B, C, D]>;

// 4 streams with selector
export function zip<A, B, C, D, R>(
  sourceA: ReadableStream<A>, 
  sourceB: ReadableStream<B>,
  sourceC: ReadableStream<C>,
  sourceD: ReadableStream<D>,
  selector: (a: A, b: B, c: C, d: D) => R
): ReadableStream<R>;

// Legacy array support (homogeneous streams)
export function zip<T>(sources: ReadableStream<T>[]): ReadableStream<T[]>;

// Implementation
export function zip(...args: any[]): ReadableStream<any> {
  // Handle legacy array format
  if (args.length === 1 && Array.isArray(args[0])) {
    return zipArray(args[0]);
  }

  // Extract selector if it's the last argument and a function
  const lastArg = args[args.length - 1];
  const hasSelector = typeof lastArg === 'function';
  const selector = hasSelector ? lastArg : null;
  const sources = hasSelector ? args.slice(0, -1) : args;

  // Create the base zip stream
  const baseStream = zipSources(sources);

  // Apply selector if provided
  if (selector) {
    return baseStream.pipeThrough(new TransformStream({
      transform(chunk, controller) {
        try {
          const result = selector(...chunk);
          controller.enqueue(result);
        } catch (error) {
          controller.error(error);
        }
      }
    }));
  }

  return baseStream;
}

/**
 * Core zip implementation for multiple sources
 */
function zipSources(sources: ReadableStream<any>[]): ReadableStream<any[]> {
  let readers: ReadableStreamDefaultReader<any>[] | null = null;

  return new ReadableStream<any[]>({
    async start() {
      // Handle empty array case immediately
      if (sources.length === 0) {
        readers = [];
        return;
      }
      readers = sources.map(s => s.getReader());
    },
    async pull(controller) {
      try {
        if (!readers) return;
        
        // Handle empty sources case
        if (readers.length === 0) {
          controller.close();
          return;
        }
        
        const results = await Promise.all(readers.map(r => r.read()));
        const isDone = results.some(result => result.done);
        
        if (isDone) {
          controller.close();
          // Release readers that aren't done
          results.forEach((result, index) => {
            if (!result.done && readers![index]) {
              try {
                readers![index].releaseLock();
              } catch (e) {
                // Ignore cleanup errors
              }
            }
          });
          readers = null;
        } else {
          const values = results.map(result => result.value);
          controller.enqueue(values);
        }
      } catch (error) {
        controller.error(error);
        // Cleanup on error
        if (readers) {
          await Promise.all(readers.map(async reader => {
            try {
              await reader.cancel(error);
              reader.releaseLock();
            } catch (e) {
              // Ignore cleanup errors
            }
          }));
          readers = null;
        }
      }
    },
    async cancel(reason?: any) {
      if (readers) {
        await Promise.all(readers.map(async reader => {
          try {
            await reader.cancel(reason);
            reader.releaseLock();
          } catch (e) {
            // Ignore cleanup errors
          }
        }));
        readers = null;
      }
    }
  });
}

/**
 * Legacy implementation for array of homogeneous streams
 */
function zipArray<T>(sources: ReadableStream<T>[]): ReadableStream<T[]> {
  return zipSources(sources) as ReadableStream<T[]>;
}