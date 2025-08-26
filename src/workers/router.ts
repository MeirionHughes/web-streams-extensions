import type { ProtocolMsg, StreamId } from './protocol.js';
import { StreamState } from './protocol.js';
import type { GetTransferablesFn } from './transferables.js';

// Per-stream state tracking
export interface StreamInfo {
  id: StreamId;
  state: StreamState;
  name?: string;
  pendingCredits?: number;
  cleanup?: () => void;
  timeoutId?: number;
  getTransferables?: GetTransferablesFn;
}

// Message router for handling protocol messages
export class MessageRouter {
  private streams = new Map<StreamId, StreamInfo>();
  private nextId = 1;
  private handlers = new Map<string, (msg: ProtocolMsg) => void>();
  private nextRequestId = 1;
  private pendingIdRequests = new Map<number, (id: StreamId) => void>();

  // Generate unique stream ID (only used by worker)
  generateId(): StreamId {
    return this.nextId++;
  }

  // Generate unique request ID for ID requests
  generateRequestId(): number {
    return this.nextRequestId++;
  }

  // Register stream with initial state
  registerStream(id: StreamId, name?: string): StreamInfo {
    const info: StreamInfo = {
      id,
      state: StreamState.Created,
      name,
      pendingCredits: 0
    };
    this.streams.set(id, info);
    return info;
  }

  // Update stream state
  updateState(id: StreamId, state: StreamState): void {
    const info = this.streams.get(id);
    if (info) {
      info.state = state;
    }
  }

  // Get stream info
  getStream(id: StreamId): StreamInfo | undefined {
    return this.streams.get(id);
  }

  // Clean up stream and remove from tracking
  closeStream(id: StreamId): void {
    const info = this.streams.get(id);
    if (info) {
      if (info.cleanup) {
        info.cleanup();
      }
      if (info.timeoutId) {
        clearTimeout(info.timeoutId);
      }
      this.streams.delete(id);
    }
  }

  // Register message handler for specific message types
  on(type: string, handler: (msg: ProtocolMsg) => void): void {
    this.handlers.set(type, handler);
  }

  // Route incoming message to appropriate handler
  route(msg: ProtocolMsg): void {
    console.log(`[Router] Routing message type: ${msg.type}`, msg);
    const handler = this.handlers.get(msg.type);
    if (handler) {
      try {
        console.log(`[Router] Found handler for ${msg.type}, executing...`);
        handler(msg);
      } catch (error) {
        console.error(`Error handling ${msg.type} message:`, error);
        // Send error response if possible (only for messages with stream IDs)
        if ('id' in msg) {
          this.sendError(msg.id, error);
        }
      }
    } else {
      console.warn(`No handler for message type: ${msg.type}`, 'Available handlers:', Array.from(this.handlers.keys()));
    }
  }

  // Request a stream ID from the worker (main thread only)
  async requestStreamId(): Promise<StreamId> {
    const requestId = this.generateRequestId();
    console.log(`[Router] Requesting stream ID with requestId: ${requestId}`);
    
    return new Promise<StreamId>((resolve) => {
      this.pendingIdRequests.set(requestId, resolve);
      console.log(`[Router] Added pending request ${requestId}, sending ID request...`);
      this.sendIdRequest(requestId);
    });
  }

  // Handle ID response (main thread only)
  handleIdResponse(requestId: number, streamId: StreamId): void {
    console.log(`[Router] Handling ID response: requestId=${requestId}, streamId=${streamId}`);
    const resolver = this.pendingIdRequests.get(requestId);
    if (resolver) {
      console.log(`[Router] Found pending request ${requestId}, resolving with streamId ${streamId}`);
      this.pendingIdRequests.delete(requestId);
      resolver(streamId);
    } else {
      console.warn(`[Router] No pending request found for requestId: ${requestId}`);
    }
  }

  // Send ID request (to be overridden by main thread router)
  protected sendIdRequest(requestId: number): void {
    // Override in main thread router
  }

  // Send error message (to be implemented by subclasses)
  protected sendError(id: StreamId, error: any): void {
    // Override in subclasses
  }

  // Get all active streams
  getActiveStreams(): StreamInfo[] {
    return Array.from(this.streams.values());
  }

  // Cleanup all streams
  cleanup(): void {
    for (const [id] of this.streams) {
      this.closeStream(id);
    }
    this.handlers.clear();
    this.pendingIdRequests.clear();
  }
}