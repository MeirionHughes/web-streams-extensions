import { MessageRouter } from '../workers/router.js';
import { StreamState } from '../workers/protocol.js';
import { validateTransferableValue, defaultGetTransferables } from '../workers/transferables.js';
import type { 
  ProtocolMsg, 
  BridgeOptions,
  StreamId,
  StreamAcceptMsg,
  StreamRejectMsg,
  DataFromWorkerMsg,
  PullRequestMsg,
  CancelMsg,
  ProtocolErrorMsg,
  IdResponseMsg
} from '../workers/protocol.js';

// Shared router instances per worker
const workerRouters = new WeakMap<Worker, MainThreadRouter>();

// Main thread message router
class MainThreadRouter extends MessageRouter {
  private worker: Worker;

  constructor(worker: Worker) {
    super();
    this.worker = worker;
    this.setupHandlers();
    
    // Listen for messages from worker
    const messageHandler = (event: MessageEvent) => {
      const msg: ProtocolMsg = event.data;
      if (msg && typeof msg === 'object' && 'type' in msg) {
        // Messages can have either 'id' (stream messages) or 'requestId' (id-request/id-response)
        this.route(msg);
      }
    };

    // Try setting onmessage first, fall back to addEventListener if it fails
    try {
      this.worker.onmessage = messageHandler;
    } catch (error) {
      this.worker.addEventListener('message', messageHandler);
    }
  }

  private setupHandlers(): void {
    this.on('id-response', (msg) => this.handleIdResponseMessage(msg as IdResponseMsg));
    this.on('stream-accept', (msg) => this.handleStreamAccept(msg as StreamAcceptMsg));
    this.on('stream-reject', (msg) => this.handleStreamReject(msg as StreamRejectMsg));
    this.on('data-from-worker', (msg) => this.handleDataFromWorker(msg as DataFromWorkerMsg));
    this.on('pull-request', (msg) => this.handlePullRequest(msg as PullRequestMsg));
    this.on('cancel', (msg) => this.handleCancel(msg as CancelMsg));
    this.on('error', (msg) => this.handleError(msg as ProtocolErrorMsg));
  }

  private handleIdResponseMessage(msg: IdResponseMsg): void {
    this.handleIdResponse(msg.requestId, msg.streamId);
  }

  private handleStreamAccept(msg: StreamAcceptMsg): void {
    const streamInfo = this.getStream(msg.id);
    if (streamInfo) {
      this.updateState(msg.id, StreamState.Accepted);
      // Clear timeout if set
      if ((streamInfo as any).timeoutId) {
        clearTimeout((streamInfo as any).timeoutId);
        delete (streamInfo as any).timeoutId;
      }
      // Resolve pending promise stored in streamInfo
      if ((streamInfo as any).resolveAccept) {
        (streamInfo as any).resolveAccept();
      }
    }
  }

  private handleStreamReject(msg: StreamRejectMsg): void {
    const streamInfo = this.getStream(msg.id);
    if (streamInfo) {
      this.updateState(msg.id, StreamState.Rejected);
      // Clear timeout if set
      if ((streamInfo as any).timeoutId) {
        clearTimeout((streamInfo as any).timeoutId);
        delete (streamInfo as any).timeoutId;
      }
      // Reject pending promise stored in streamInfo
      if ((streamInfo as any).rejectAccept) {
        (streamInfo as any).rejectAccept(new Error(msg.reason || 'Stream rejected'));
      }
    }
  }

  private handleDataFromWorker(msg: DataFromWorkerMsg): void {
    const streamInfo = this.getStream(msg.id);
    if (!streamInfo || !(streamInfo as any).outputController) {
      return;
    }

    const controller = (streamInfo as any).outputController;
    
    if (msg.error) {
      controller.error(new Error(msg.error));
      this.closeStream(msg.id);
      return;
    }
    
    if (msg.done) {
      controller.close();
      this.closeStream(msg.id);
      return;
    }
    
    if (msg.chunk !== undefined) {
      try {
        controller.enqueue(msg.chunk);
      } catch (error) {
        this.closeStream(msg.id);
      }
    }
  }

  private handlePullRequest(msg: PullRequestMsg): void {
    const streamInfo = this.getStream(msg.id);
    if (!streamInfo) return;

    // Grant credits to read from source
    const desiredSize = msg.desiredSize ?? 1;
    streamInfo.pendingCredits = (streamInfo.pendingCredits ?? 0) + desiredSize;
    
    // Trigger reading if we have a reader
    if ((streamInfo as any).triggerRead) {
      (streamInfo as any).triggerRead();
    }
  }

  private handleCancel(msg: CancelMsg): void {
    const streamInfo = this.getStream(msg.id);
    if (streamInfo && (streamInfo as any).outputController) {
      const controller = (streamInfo as any).outputController;
      controller.error(new Error(msg.reason || 'Stream cancelled'));
    }
    this.closeStream(msg.id);
  }

  private handleError(msg: ProtocolErrorMsg): void {
    const streamInfo = this.getStream(msg.id);
    if (streamInfo && (streamInfo as any).outputController) {
      const controller = (streamInfo as any).outputController;
      controller.error(new Error(msg.error));
      this.closeStream(msg.id);
    }
  }

  protected sendError(id: StreamId, error: any): void {
    this.sendMessage({
      id,
      type: 'error',
      error: error.message || error
    });
  }

  protected sendIdRequest(requestId: number): void {
    this.worker.postMessage({
      type: 'id-request',
      requestId
    });
  }

  sendMessage(msg: ProtocolMsg): void {
    const transferList = (msg as any).transferList;
    if (transferList && transferList.length > 0) {
      this.worker.postMessage(msg, transferList);
    } else {
      this.worker.postMessage(msg);
    }
  }

  // Get transferables for a value using stream-specific function
  getTransferables(value: any, streamId: StreamId): Transferable[] {
    const streamInfo = this.getStream(streamId);
    const getTransferablesFn = streamInfo?.getTransferables || defaultGetTransferables;
    
    // Validate the value first
    validateTransferableValue(value);
    return getTransferablesFn(value);
  }

  // Request a new stream from worker
  async requestStream(name: string, options?: BridgeOptions<unknown>): Promise<StreamId> {
    // First, request a stream ID from the worker
    const id = await this.requestStreamId();
    
    const streamInfo = this.registerStream(id, name);
    
    // Store stream-specific getTransferables function
    if (options?.getTransferables) {
      streamInfo.getTransferables = options.getTransferables;
    }
    
    // Setup promise for accept/reject
    const acceptPromise = new Promise<void>((resolve, reject) => {
      (streamInfo as any).resolveAccept = resolve;
      (streamInfo as any).rejectAccept = reject;
      
      // Setup timeout if specified
      if (options?.timeout) {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Stream request timeout after ${options.timeout}ms`));
          this.closeStream(id);
        }, options.timeout);
        (streamInfo as any).timeoutId = timeoutId;
      }
    });

    // Send stream request using the worker-generated ID
    this.sendMessage({
      id,
      type: 'stream-request',
      name
    });

    this.updateState(id, StreamState.Requested);
    
    // Wait for accept/reject
    await acceptPromise;
    return id;
  }
}

/**
 * Creates a bridge operator that processes streams in a Web Worker. 
 * the Worker must use the onStream function from 'web-streams-extensions/worker'
 * 
 * @param worker - The Web Worker instance running the onStream router
 * @param name - Stream type name for worker routing
 * @param options - Configuration options
 * @returns Transform operator for use with pipe()
 */
export function bridge<T, U = unknown>(
  worker: Worker,
  name: string,
  options?: BridgeOptions<U>
): (src: ReadableStream<T>, strategy?: QueuingStrategy<U>) => ReadableStream<U> {
  return function (src: ReadableStream<T>, strategy?: QueuingStrategy<U>): ReadableStream<U> {
    // Get or create shared router for this worker
    let router = workerRouters.get(worker);
    if (!router) {
      router = new MainThreadRouter(worker);
      workerRouters.set(worker, router);
    }

    let streamId: StreamId;
    let cleanup: (() => void) | null = null;

    return new ReadableStream<U>({
      async start(controller) {
        try {
          // Request stream using shared router
          streamId = await router.requestStream(name, options);
          
          const streamInfo = router.getStream(streamId);
          if (!streamInfo) {
            throw new Error('Failed to get stream info');
          }

          // Store controller for data handling
          (streamInfo as any).outputController = controller;
          
          // Setup source reading
          const reader = src.getReader();
          let reading = false;

          const triggerRead = async () => {
            if (reading || !streamInfo.pendingCredits || streamInfo.pendingCredits <= 0) {
              return;
            }
            
            reading = true;
            
            try {
              while (streamInfo.pendingCredits && streamInfo.pendingCredits > 0) {
                const { done, value } = await reader.read();
                
                if (done) {
                  router.sendMessage({
                    id: streamId,
                    type: 'data-to-worker',
                    done: true
                  });
                  break;
                }
                
                // Validate and detect transferables
                const transferList = router.getTransferables(value, streamId);

                router.sendMessage({
                  id: streamId,
                  type: 'data-to-worker',
                  chunk: value,
                  transferList: transferList.length > 0 ? transferList : undefined
                });
                
                streamInfo.pendingCredits!--;
              }
            } catch (error) {
              router.sendMessage({
                id: streamId,
                type: 'data-to-worker',
                error: error.message || error
              });
              controller.error(error);
            } finally {
              reading = false;
            }
          };

          (streamInfo as any).triggerRead = triggerRead;
          
          cleanup = () => {
            reader.releaseLock();
            router.closeStream(streamId);
          };

          // Handle abort signal
          if (options?.signal) {
            options.signal.addEventListener('abort', cleanup);
          }
          
        } catch (error) {
          controller.error(error);
        }
      },
      
      cancel(reason) {
        if (cleanup) {
          cleanup();
        }
        if (router && streamId) {
          router.sendMessage({
            id: streamId,
            type: 'cancel',
            reason
          });
        }
      }
    }, strategy);
  };
}
