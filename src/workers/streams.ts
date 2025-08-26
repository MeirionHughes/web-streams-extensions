import type { StreamId, DataToWorkerMsg, DataFromWorkerMsg, PullRequestMsg } from './protocol.js';

// Worker-side ReadableStream that requests data from main thread
export class WorkerReadableStream<T = any> {
  private controller!: ReadableStreamDefaultController<T>;
  private streamId: StreamId;
  private sendMessage: (msg: any) => void;
  private pendingPull = false;

  constructor(streamId: StreamId, sendMessage: (msg: any) => void) {
    this.streamId = streamId;
    this.sendMessage = sendMessage;
  }

  // Create the actual ReadableStream
  createStream(strategy?: QueuingStrategy<T>): ReadableStream<T> {
    return new ReadableStream<T>({
      start: (controller) => {
        this.controller = controller;
      },
      pull: () => {
        this.requestData();
      },
      cancel: (reason) => {
        this.sendMessage({
          id: this.streamId,
          type: 'cancel',
          reason
        });
      }
    }, strategy);
  }

  // Request data from main thread based on controller's desiredSize
  private requestData(): void {
    if (this.pendingPull) return;
    
    this.pendingPull = true;
    const desiredSize = this.controller.desiredSize ?? 16; // Default batch size
    
    const pullMsg: PullRequestMsg = {
      id: this.streamId,
      type: 'pull-request',
      desiredSize: Math.max(desiredSize, 1) // Ensure at least 1
    };
    
    this.sendMessage(pullMsg);
  }

  // Handle incoming data from main thread
  handleData(msg: DataToWorkerMsg): void {
    this.pendingPull = false;
    
    if (msg.error) {
      this.controller.error(new Error(msg.error));
      return;
    }
    
    if (msg.done) {
      this.controller.close();
      return;
    }
    
    if (msg.chunk !== undefined) {
      this.controller.enqueue(msg.chunk);
    }
  }
}

// Worker-side WritableStream that sends data to main thread
export class WorkerWritableStream<T = any> {
  private streamId: StreamId;
  private sendMessage: (msg: any) => void;
  private getTransferables: (value: any) => Transferable[];

  constructor(
    streamId: StreamId, 
    sendMessage: (msg: any) => void,
    getTransferables: (value: any) => Transferable[]
  ) {
    this.streamId = streamId;
    this.sendMessage = sendMessage;
    this.getTransferables = getTransferables;
  }

  // Create the actual WritableStream
  createStream(strategy?: QueuingStrategy<T>): WritableStream<T> {
    return new WritableStream<T>({
      write: (chunk) => {
        this.sendData(chunk);
      },
      close: () => {
        this.sendMessage({
          id: this.streamId,
          type: 'data-from-worker',
          done: true
        });
      },
      abort: (reason) => {
        this.sendMessage({
          id: this.streamId,
          type: 'data-from-worker',
          error: reason?.message || reason
        });
      }
    }, strategy);
  }

  // Send data chunk to main thread
  private sendData(chunk: T): void {
    // Validate and detect transferables
    const transferList = this.getTransferables(chunk);

    const dataMsg: DataFromWorkerMsg = {
      id: this.streamId,
      type: 'data-from-worker',
      chunk,
      transferList: transferList.length > 0 ? transferList : undefined
    };
    
    this.sendMessage(dataMsg);
  }
}