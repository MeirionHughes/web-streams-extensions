import { MessageRouter } from './router.js';
import { WorkerReadableStream, WorkerWritableStream } from './streams.js';
import { StreamState } from './protocol.js';
import { createTransferHandler, defaultGetTransferables } from './transferables.js';
import type { 
  ProtocolMsg, 
  StreamHandler, 
  StreamRequest, 
  StreamRequestMsg,
  DataToWorkerMsg,
  CancelMsg,
  IdRequestMsg,
  IdResponseMsg,
  GetTransferablesFn
} from './protocol.js';

// Worker-side message router that extends base router
class WorkerMessageRouter extends MessageRouter {
  private postMessage: (msg: any, transferList?: Transferable[]) => void;
  private transferHandler: ReturnType<typeof createTransferHandler>;

  constructor(
    postMessage: (msg: any, transferList?: Transferable[]) => void,
    getTransferables?: GetTransferablesFn
  ) {
    super();
    this.postMessage = postMessage;
    this.transferHandler = createTransferHandler(getTransferables || defaultGetTransferables);
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.on('id-request', (msg) => this.handleIdRequest(msg as IdRequestMsg));
    this.on('stream-request', (msg) => this.handleStreamRequest(msg as StreamRequestMsg));
    this.on('data-to-worker', (msg) => this.handleDataToWorker(msg as DataToWorkerMsg));
    this.on('cancel', (msg) => this.handleCancel(msg as CancelMsg));
  }

  private handleIdRequest(msg: IdRequestMsg): void {
    console.log('[Worker] WorkerMessageRouter: Received ID request with requestId:', msg.requestId);
    
    // Generate a new stream ID and send it back
    const streamId = this.generateId();
    
    console.log('[Worker] WorkerMessageRouter: Sending ID response with streamId:', streamId, 'for requestId:', msg.requestId);
    
    this.postMessage({
      type: 'id-response',
      requestId: msg.requestId,
      streamId
    });
  }

  private handleStreamRequest(msg: StreamRequestMsg): void {
    const streamInfo = this.registerStream(msg.id, msg.name);
    this.updateState(msg.id, StreamState.Requested);

    // Create stream request object
    const request: StreamRequest = {
      name: msg.name,
      accept: () => {
        this.updateState(msg.id, StreamState.Accepted);
        
        // Send accept message
        this.postMessage({
          id: msg.id,
          type: 'stream-accept'
        });

        // Create worker streams
        const readableWrapper = new WorkerReadableStream(msg.id, (msg) => {
          this.postMessage(msg, msg.transferList);
        });
        const writableWrapper = new WorkerWritableStream(msg.id, (msg) => {
          this.postMessage(msg, msg.transferList);
        }, (value) => this.getTransferables(value));

        // Store stream wrappers for data routing
        (streamInfo as any).readableWrapper = readableWrapper;
        (streamInfo as any).writableWrapper = writableWrapper;

        streamInfo.cleanup = () => {
          // Cleanup logic if needed
        };

        this.updateState(msg.id, StreamState.Active);
        
        return {
          readable: readableWrapper.createStream(),
          writable: writableWrapper.createStream()
        };
      },
      reject: (reason?: any) => {
        this.updateState(msg.id, StreamState.Rejected);
        
        // Send reject message
        this.postMessage({
          id: msg.id,
          type: 'stream-reject',
          reason
        });

        this.closeStream(msg.id);
      }
    };

    // Trigger user handler
    if (workerStreamHandler) {
      try {
        workerStreamHandler(request);
      } catch (error) {
        console.error('Error in stream handler:', error);
        request.reject((error as any).message || 'Stream handler error');
      }
    } else {
      request.reject('No stream handler registered');
    }
  }

  private handleDataToWorker(msg: DataToWorkerMsg): void {
    const streamInfo = this.getStream(msg.id);
    if (!streamInfo) {
      console.warn(`Received data for unknown stream ${msg.id}`);
      return;
    }

    // Route data to the readable stream wrapper
    const readableWrapper = (streamInfo as any).readableWrapper;
    if (readableWrapper) {
      readableWrapper.handleData(msg);
    }
  }

  private handleCancel(msg: CancelMsg): void {
    this.closeStream(msg.id);
  }

  protected sendError(id: number, error: any): void {
    this.postMessage({
      id,
      type: 'error',
      error: error.message || error
    });
  }

  // Get transferables for a value
  getTransferables(value: any): Transferable[] {
    return this.transferHandler.getTransferables(value);
  }
}

// Global router instance for worker
let workerRouter: WorkerMessageRouter | null = null;
let workerStreamHandler: StreamHandler | null = null;

// Initialize worker message handling
function initializeWorker(getTransferables?: GetTransferablesFn): void {
  if (workerRouter) return; // Already initialized

  workerRouter = new WorkerMessageRouter((msg, transferList) => {
    if (typeof self !== 'undefined' && self.postMessage) {
      if (transferList && transferList.length > 0) {
        (self as any).postMessage(msg, transferList);
      } else {
        self.postMessage(msg);
      }
    } else {
      console.error('Worker postMessage not available');
    }
  }, getTransferables);

  // Listen for messages from main thread
  if (typeof self !== 'undefined') {
    self.onmessage = (event: MessageEvent) => {
      console.log('[Worker] Received message from main thread:', event.data);
      const msg: ProtocolMsg = event.data;
      if (msg && typeof msg === 'object' && 'type' in msg) {
        console.log(`[Worker] Valid message with type: ${msg.type}`);
        // Messages can have either 'id' (stream messages) or 'requestId' (id-request/id-response)
        workerRouter!.route(msg);
      } else {
        console.warn('[Worker] Invalid message format:', msg);
      }
    };
  }
}

// Public API: Register stream handler
export function onStream(handler: StreamHandler, getTransferables?: GetTransferablesFn): void {
  workerStreamHandler = handler;
  initializeWorker(getTransferables);
}

// Cleanup function for testing
export function _resetWorker(): void {
  if (workerRouter) {
    workerRouter.cleanup();
  }
  workerRouter = null;
  workerStreamHandler = null;
}