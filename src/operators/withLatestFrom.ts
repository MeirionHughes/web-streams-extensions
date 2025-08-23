/**
 * Combines each source value with the latest values from other streams.
 * Only emits when the source stream emits, using the most recent values from other streams.
 * If other streams haven't emitted yet, no value is emitted from the source.
 * 
 * @template T The type of values from the source stream
 * @template Others The types of values from other streams
 * @param others Other streams to combine with
 * @returns A stream operator that combines source with latest from others
 * 
 * @example
 * ```typescript
 * // Combine button clicks with latest user state
 * pipe(
 *   buttonClicks,
 *   withLatestFrom(userState),
 *   map(([click, state]) => ({ action: click.type, user: state.id }))
 * )
 * // Only emits when button is clicked, with current user state
 * 
 * // Multiple sources
 * pipe(
 *   formSubmissions,
 *   withLatestFrom(userPreferences, validationState),
 *   map(([form, prefs, validation]) => ({ 
 *     form, 
 *     preferences: prefs, 
 *     isValid: validation.valid 
 *   }))
 * )
 * ```
 */

// Single other stream
export function withLatestFrom<T, A>(
  other: ReadableStream<A>
): (src: ReadableStream<T>, strategy?: QueuingStrategy<[T, A]>) => ReadableStream<[T, A]>;

// Two other streams  
export function withLatestFrom<T, A, B>(
  otherA: ReadableStream<A>,
  otherB: ReadableStream<B>
): (src: ReadableStream<T>, strategy?: QueuingStrategy<[T, A, B]>) => ReadableStream<[T, A, B]>;

// Three other streams
export function withLatestFrom<T, A, B, C>(
  otherA: ReadableStream<A>,
  otherB: ReadableStream<B>,
  otherC: ReadableStream<C>
): (src: ReadableStream<T>, strategy?: QueuingStrategy<[T, A, B, C]>) => ReadableStream<[T, A, B, C]>;

// Implementation
export function withLatestFrom<T>(...others: ReadableStream<any>[]): (
  src: ReadableStream<T>, 
  strategy?: QueuingStrategy<[T, ...any[]]>
) => ReadableStream<[T, ...any[]]> {
  return function (src: ReadableStream<T>, strategy: QueuingStrategy<[T, ...any[]]> = { highWaterMark: 16 }) {
    let sourceReader: ReadableStreamDefaultReader<T> = null;
    let otherReaders: ReadableStreamDefaultReader<any>[] = [];
    let latestValues: any[] = new Array(others.length);
    let hasValues: boolean[] = new Array(others.length).fill(false);
    let sourceDone = false;
    let othersDone: boolean[] = new Array(others.length).fill(false);

    // Start reading from other streams
    async function startOthers() {
      otherReaders = others.map(stream => stream.getReader());
      
      // Read from each other stream continuously
      others.forEach(async (_, index) => {
        try {
          while (!othersDone[index]) {
            const { done, value } = await otherReaders[index].read();
            if (done) {
              othersDone[index] = true;
              break;
            }
            latestValues[index] = value;
            hasValues[index] = true;
          }
        } catch (err) {
          // Stream errored, mark as done
          othersDone[index] = true;
        }
      });
    }

    async function flush(controller: ReadableStreamDefaultController<[T, ...any[]]>) {
      try {
        while (controller.desiredSize > 0 && sourceReader != null && !sourceDone) {
          let { done, value } = await sourceReader.read();
          
          if (done) {
            sourceDone = true;
            controller.close();
            return;
          }

          // Only emit if all other streams have emitted at least once
          if (hasValues.every(has => has)) {
            const combined: [T, ...any[]] = [value, ...latestValues];
            controller.enqueue(combined);
          }
          // If not all have values yet, skip this source emission
        }
      } catch (err) {
        controller.error(err);
      }
    }

    return new ReadableStream<[T, ...any[]]>({
      async start(controller) {
        sourceReader = src.getReader();
        await startOthers();
        await flush(controller);
      },
      async pull(controller) {
        await flush(controller);
      },
      cancel() {
        if (sourceReader) {
          sourceReader.releaseLock();
          sourceReader = null;
        }
        
        otherReaders.forEach(reader => {
          if (reader) {
            reader.cancel();
            reader.releaseLock();
          }
        });
        otherReaders = [];
      }
    }, strategy);
  };
}
