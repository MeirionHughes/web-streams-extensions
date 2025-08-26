// Core protocol types for worker streaming

import type { GetTransferablesFn } from './transferables.js';

export type { GetTransferablesFn };
export type StreamId = number;

// Message envelope - all messages include id and type
export interface BaseMessage {
  id: StreamId;
  type: string;
}

// Lifecycle messages
export interface StreamRequestMsg extends BaseMessage {
  type: 'stream-request';
  name: string;
}

export interface StreamAcceptMsg extends BaseMessage {
  type: 'stream-accept';
}

export interface StreamRejectMsg extends BaseMessage {
  type: 'stream-reject';
  reason?: any;
}

// Flow control messages
export interface PullRequestMsg extends BaseMessage {
  type: 'pull-request';
  desiredSize?: number;
}

export interface PullAckMsg extends BaseMessage {
  type: 'pull-ack';
}

export interface PauseMsg extends BaseMessage {
  type: 'pause';
}

// Data messages
export interface DataToWorkerMsg extends BaseMessage {
  type: 'data-to-worker';
  chunk?: any;
  done?: boolean;
  error?: any;
  transferList?: Transferable[];
}

export interface DataFromWorkerMsg extends BaseMessage {
  type: 'data-from-worker';
  chunk?: any;
  done?: boolean;
  error?: any;
  transferList?: Transferable[];
}

// Control messages
export interface CancelMsg extends BaseMessage {
  type: 'cancel';
  reason?: any;
}

export interface ProtocolErrorMsg extends BaseMessage {
  type: 'error';
  error: any;
}

// ID generation messages
export interface IdRequestMsg {
  type: 'id-request';
  requestId: number; // Separate ID for the request itself
}

export interface IdResponseMsg {
  type: 'id-response';
  requestId: number;
  streamId: StreamId;
}

// Union type for all protocol messages
export type ProtocolMsg =
  | StreamRequestMsg
  | StreamAcceptMsg
  | StreamRejectMsg
  | PullRequestMsg
  | PullAckMsg
  | PauseMsg
  | DataToWorkerMsg
  | DataFromWorkerMsg
  | CancelMsg
  | ProtocolErrorMsg
  | IdRequestMsg
  | IdResponseMsg;

// Stream states
export enum StreamState {
  Created = 'created',
  Requested = 'requested',
  Accepted = 'accepted',
  Rejected = 'rejected',
  Active = 'active',
  Closing = 'closing',
  Errored = 'errored',
  Cancelled = 'cancelled',
  Closed = 'closed'
}

// Stream request handler types
export interface StreamRequest {
  name: string;
  accept(): { readable: ReadableStream<any>; writable: WritableStream<any> };
  reject(reason?: any): void;
}

export type StreamHandler = (request: StreamRequest) => void;

// Options for bridge operator
export interface BridgeOptions<U = unknown> {
  signal?: AbortSignal;
  timeout?: number;
  getTransferables?: GetTransferablesFn;
  validate?(value: unknown): value is U
}