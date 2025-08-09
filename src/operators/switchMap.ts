/**
 * Maps each source value to a stream and flattens them, but only the most recent inner stream.
 * When a new inner stream is created, the previous one is cancelled and any ongoing operations
 * are aborted via the provided AbortSignal.
 * 
 * @template T The input type
 * @template R The output type
 * @param project Function that maps values to streams. Receives (value, index, signal) where
 *                signal is an AbortSignal that will be aborted when this projection is cancelled
 * @returns A stream operator that switches to new streams with proper cancellation support
 * 
 * @example
 * ```typescript
 * // Basic synchronous switchMap - each new source value cancels previous inner stream
 * pipe(
 *   from([1, 2, 3]),
 *   switchMap(x => from([x * 10, x * 100]))
 * )
 * // Result: [10, 20, 30, 300] - inner streams cancelled except the last one
 * 
 * // Real-world example: search with proper HTTP request cancellation
 * pipe(
 *   userSearchInput,
 *   debounceTime(300),
 *   switchMap((searchTerm, index, signal) => 
 *     fetch(`/api/search?q=${searchTerm}`, { signal })  // Pass signal to fetch
 *       .then(response => response.json())
 *       .then(results => from(results))
 *   )
 * )
 * // Previous HTTP requests are properly cancelled when user types new characters
 * 
 * // Example with custom cancellable operation
 * pipe(
 *   from(['task1', 'task2', 'task3']),
 *   switchMap((task, index, signal) => {
 *     return new ReadableStream({
 *       start(controller) {
 *         const timer = setTimeout(() => {
 *           if (!signal?.aborted) {
 *             controller.enqueue(`${task} completed`);
 *             controller.close();
 *           }
 *         }, 1000);
 *         
 *         signal?.addEventListener('abort', () => {
 *           clearTimeout(timer);
 *           controller.close(); // Clean up on cancellation
 *         });
 *       }
 *     });
 *   })
 * )
 * // Only the last task completes, previous ones are cancelled
 * ```
 */

import { BlockingQueue } from '../utils/signal.js';

interface QueueItem<R> {
  type: 'value' | 'complete' | 'error';
  value?: R;
  error?: any;
}

export function switchMap<T, R>(
  project: (value: T, index: number, signal?: AbortSignal) => ReadableStream<R> | Promise<ReadableStream<R>>
): (src: ReadableStream<T>, opts?: { highWaterMark?: number }) => ReadableStream<R> {
  return function (src: ReadableStream<T>, { highWaterMark = 16 } = {}) {
    
    let queue: BlockingQueue<QueueItem<R>>;
    let currentInnerReader: ReadableStreamDefaultReader<R> | null = null;
    let sourceReader: ReadableStreamDefaultReader<T> | null = null;
    let sourceDone = false;
    let currentReaderActive = false;
    let sourceMonitorStarted = false;
    let consumerRunning = false;
    let controller: ReadableStreamDefaultController<R>;
    let pullResolver: (() => void) | null = null;
    let index = 0;
    let currentAbortController: AbortController | null = null;
    
    // Producer: Independent source stream monitor
    const startSourceMonitor = () => {
      if (sourceMonitorStarted) return;
      sourceMonitorStarted = true;
      
      const sourceMonitor = async () => {
        try {
          sourceReader = src.getReader();
          
          while (!sourceDone) {
            const { done, value } = await sourceReader.read();
            
            if (done) {
              sourceDone = true;
              // If no active inner reader, signal completion
              if (!currentReaderActive) {
                await queue.push({ type: 'complete' });
              }
              break;
            }
            
            // New source value arrived - cancel current reader and abort current operation
            if (currentInnerReader) {
              currentReaderActive = false; // Revoke ownership
              try {
                await currentInnerReader.cancel();
              } catch (err) {
                // Ignore cancellation errors
              }
              currentInnerReader = null;
            }
            
            // Abort the current operation if there's one
            if (currentAbortController) {
              currentAbortController.abort();
            }
            
            // Create new AbortController for the new operation
            currentAbortController = new AbortController();
            
            // Create new inner stream from the mapped value with abort signal
            const innerStream = await project(value, index++, currentAbortController.signal);
            currentInnerReader = innerStream.getReader();
            currentReaderActive = true; // Grant ownership
            
            // Start reading from the new inner stream
            readFromInnerStream();
          }
        } catch (err) {
          await queue.push({ type: 'error', error: err });
        }
      };
      
      sourceMonitor(); // Start but don't await
    };
    
    // Producer: Read from current inner stream
    const readFromInnerStream = () => {
      const reader = currentInnerReader;
      if (!reader) return;
      
      const readLoop = async () => {
        try {
          while (currentReaderActive && reader === currentInnerReader) {
            const { done, value } = await reader.read();
            
            // Check if we still have ownership (might have been switched)
            if (!currentReaderActive || reader !== currentInnerReader) {
              break;
            }
            
            if (done) {
              currentReaderActive = false;
              currentInnerReader = null;
              
              // If source is also done, signal completion
              if (sourceDone) {
                await queue.push({ type: 'complete' });
              }
              break;
            }
            
            await queue.push({ type: 'value', value });
          }
        } catch (err) {
          if (currentReaderActive && reader === currentInnerReader) {
            await queue.push({ type: 'error', error: err });
          }
        }
      };
      
      readLoop(); // Start but don't await
    };
    
    // Consumer: Read from queue and emit to controller (respecting backpressure)
    const startConsumer = () => {
      const consumer = async () => {
        try {
          while (true) {
            // Respect backpressure - only consume when there's space
            while (controller.desiredSize <= 0) {
              // Wait for next pull before continuing
              await new Promise<void>(resolve => {
                pullResolver = resolve;
              });
            }
            
            const item = await queue.pull();
            
            if (item.type === 'value') {
              controller.enqueue(item.value!);
            } else if (item.type === 'complete') {
              controller.close();
              break;
            } else if (item.type === 'error') {
              controller.error(item.error);
              break;
            }
          }
        } catch (err) {
          controller.error(err);
        }
      };
      
      consumer(); // Start but don't await
    };
    
    const cleanup = () => {
      if (sourceReader) {
        try {
          sourceReader.releaseLock();
        } catch (err) {
          // Ignore cleanup errors
        }
        sourceReader = null;
      }
      
      if (currentInnerReader) {
        try {
          currentInnerReader.cancel();
        } catch (err) {
          // Ignore cleanup errors
        }
        currentInnerReader = null;
      }
      
      if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
      }
    };

    return new ReadableStream<R>({
      async start(ctrl) {
        controller = ctrl;
        queue = new BlockingQueue<QueueItem<R>>();
        
        // Start the source monitor
        startSourceMonitor();
      },
      
      async pull(ctrl) {
        // Only start consuming when there's demand
        if (!consumerRunning) {
          consumerRunning = true;
          startConsumer();
        }
        
        // Signal consumer that there's now demand
        if (pullResolver) {
          const resolver = pullResolver;
          pullResolver = null;
          resolver();
        }
      },
      
      cancel() {
        cleanup();
      }
    }, { highWaterMark });
  };
}
