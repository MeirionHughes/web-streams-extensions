/**
 * Flattens a higher-order ReadableStream by switching to the latest inner stream.
 * When a new inner stream arrives, the previous inner stream is cancelled and
 * the new one is subscribed to. Only the most recent inner stream emits values.
 * 
 * @template T The type of values emitted by the inner streams
 * @returns A stream operator that flattens streams by switching to the latest
 * 
 * @example
 * ```typescript
 * // Switch to latest stream - cancels previous streams when new ones arrive
 * pipe(
 *   from([
 *     delay(from(['first-1', 'first-2']), 100),
 *     delay(from(['second-1', 'second-2']), 50),
 *     from(['third-1', 'third-2'])
 *   ]),
 *   switchAll()
 * )
 * // Emits: ['third-1', 'third-2'] - earlier streams are cancelled
 * 
 * // Search suggestions - cancel previous search when new query arrives  
 * pipe(
 *   searchQueries,
 *   map(query => fetch(`/api/search?q=${query}`)),
 *   switchAll()
 * )
 * // Only the latest search request completes, previous requests are cancelled
 * ```
 */

import { BlockingQueue } from '../utils/signal.js';

interface QueueItem<T> {
  type: 'value' | 'complete' | 'error';
  value?: T;
  error?: any;
}

export function switchAll<T>(): (
  src: ReadableStream<ReadableStream<T> | Promise<ReadableStream<T>>>, 
  opts?: { highWaterMark?: number }
) => ReadableStream<T> {
  return function (src: ReadableStream<ReadableStream<T> | Promise<ReadableStream<T>>>, { highWaterMark = 16 } = {}) {
    
    let queue: BlockingQueue<QueueItem<T>>;
    let currentInnerReader: ReadableStreamDefaultReader<T> | null = null;
    let sourceReader: ReadableStreamDefaultReader<ReadableStream<T> | Promise<ReadableStream<T>>> | null = null;
    let sourceDone = false;
    let currentReaderActive = false;
    let sourceMonitorStarted = false;
    let consumerRunning = false;
    let controller: ReadableStreamDefaultController<T>;
    let pullResolver: (() => void) | null = null;
    
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
            
            // New inner stream arrived - cancel current reader
            if (currentInnerReader) {
              currentReaderActive = false; // Revoke ownership
              try {
                await currentInnerReader.cancel();
              } catch (err) {
                // Ignore cancellation errors
              }
              currentInnerReader = null;
            }
            
            // Set up new inner stream
            const innerStream = await value;
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
    };

    return new ReadableStream<T>({
      async start(ctrl) {
        controller = ctrl;
        queue = new BlockingQueue<QueueItem<T>>();
        
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
