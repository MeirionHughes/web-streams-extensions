/**
 * Creates a ReadableStream that mirrors the first source stream to emit a value.
 * Once any source emits, all other sources are cancelled and ignored.
 * The winning stream's values, completion, and errors are forwarded to the output.
 * 
 * @template T The type of values from the source streams
 * @param sources The streams to race
 * @returns A ReadableStream that mirrors the first source to emit
 * 
 * @example
 * ```typescript
 * // Race between different data sources
 * const cache = from(['cached-data']);
 * const network = fetch('/api/data').then(r => r.json());
 * const local = readLocalStorage();
 * 
 * const fastest = race(cache, from(network), local);
 * // Uses whichever source responds first
 * 
 * // Timeout pattern
 * const data = fetch('/api/slow-endpoint');
 * const timeout = timer(5000).pipe(map(() => { throw new Error('Timeout'); }));
 * const result = race(from(data), timeout);
 * // Either gets data or times out after 5 seconds
 * ```
 */
export function race<T>(...sources: ReadableStream<T>[]): ReadableStream<T> {
  if (sources.length === 0) {
    throw new Error("race requires at least one source stream");
  }

  let readers: ReadableStreamDefaultReader<T>[] = [];
  let winnerIndex: number | null = null;
  let isSettled = false;

  return new ReadableStream<T>({
    async start(controller) {
      readers = sources.map(stream => stream.getReader());
      
      // Read from each source until one emits
      const racePromises = sources.map(async (_, index) => {
        try {
          while (!isSettled) {
            const { done, value } = await readers[index].read();
            
            if (isSettled) {
              // Another source already won
              break;
            }
            
            if (done) {
              // This source completed without emitting
              if (winnerIndex === null) {
                // If no winner yet and this completes, check if all are done
                const allDone = await Promise.all(
                  readers.map(async (reader, i) => {
                    if (i === index) return true;
                    try {
                      const result = await reader.read();
                      if (!result.done) {
                        // Put the value back by creating a new stream with it
                        return false;
                      }
                      return true;
                    } catch {
                      return true;
                    }
                  })
                );
                
                if (allDone.every(done => done)) {
                  isSettled = true;
                  controller.close();
                }
              }
              break;
            }
            
            // This source emitted first!
            if (winnerIndex === null) {
              winnerIndex = index;
              isSettled = true;
              
              // Cancel all other sources
              readers.forEach((reader, i) => {
                if (i !== index && reader) {
                  reader.cancel();
                  reader.releaseLock();
                }
              });
              
              // Emit the winning value
              controller.enqueue(value);
              
              // Continue forwarding from the winner
              try {
                while (true) {
                  const nextResult = await readers[index].read();
                  if (nextResult.done) {
                    controller.close();
                    break;
                  }
                  controller.enqueue(nextResult.value);
                }
              } catch (err) {
                controller.error(err);
              }
            }
            
            break;
          }
        } catch (err) {
          if (!isSettled) {
            isSettled = true;
            winnerIndex = index;
            
            // Cancel other sources
            readers.forEach((reader, i) => {
              if (i !== index && reader) {
                reader.cancel();
                reader.releaseLock();
              }
            });
            
            controller.error(err);
          }
        }
      });
      
      await Promise.race(racePromises);
    },
    async cancel() {
      isSettled = true;
      await Promise.allSettled(readers.map(async reader => {
        if (reader) {
          try {
            await reader.cancel();
          } catch (err) {
            // Ignore cancel errors
          } finally {
            try {
              reader.releaseLock();
            } catch (err) {
              // Ignore release errors
            }
          }
        }
      }));
      readers = [];
    }
  });
}
