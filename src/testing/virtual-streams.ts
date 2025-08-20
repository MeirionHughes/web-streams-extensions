/**
 * Virtual ReadableStream Implementation
 * 
 * Feature-complete virtual implementation of ReadableStream that integrates 
 * with the VirtualTimeScheduler for deterministic testing.
 */

import type { VirtualTimeScheduler } from './virtual-tick-scheduler.js';

// ===== VIRTUAL READABLE STREAM =====

export class VirtualReadableStream<T = any> implements ReadableStream<T> {
  readonly locked: boolean = false;
  private _reader: VirtualReadableStreamDefaultReader<T> | VirtualReadableStreamBYOBReader | null = null;
  private _controller: VirtualReadableStreamDefaultController<T> | VirtualReadableByteStreamController | null = null;
  private _underlyingSource: UnderlyingSource<T>;
  private _strategy: QueuingStrategy<T>;
  private _isClosed = false;
  private _isErrored = false;
  private _errorValue: any = null;
  private _queue: T[] = [];
  private _pendingReaders: Array<{
    resolve: (result: ReadableStreamReadResult<T>) => void;
    reject: (error: any) => void;
  }> = [];
  private _cancelRequested = false;
  
  /** @internal Pending async operations count */
  private _pendingAsyncOps = 0;
  
  /** @internal Flag to track if start has completed */
  private _startCompleted = false;

  constructor(
    underlyingSource: UnderlyingSource<T> = {},
    strategy: QueuingStrategy<T> = {},
    private scheduler: VirtualTimeScheduler
  ) {
    this._underlyingSource = underlyingSource;
    this._strategy = strategy;

    // Register with scheduler for pending reader tracking
    this.scheduler.addVirtualStream(this);

    // Determine if this is a byte stream or default stream
    if ((underlyingSource as any).type === 'bytes') {
      this._controller = new VirtualReadableByteStreamController(this, scheduler);
    } else {
      this._controller = new VirtualReadableStreamDefaultController<T>(this, scheduler);
    }

    // Call start asynchronously and await it properly
    this._initializeStart();
  }

  /** @internal Initialize start method properly */
  private async _initializeStart(): Promise<void> {
    if (this._underlyingSource.start) {
      try {
        this._pendingAsyncOps++;
        const result = this._underlyingSource.start(this._controller as any);
        
        // Await start if it returns a promise
        if (result && typeof result.then === 'function') {
          await result;
        }
        
        this._startCompleted = true;
        this._pendingAsyncOps--;
        this.scheduler.log(`[VirtualStream] Start completed at tick ${this.scheduler.getCurrentTick()}`);
        
        // If there are pending readers, trigger a pull immediately now that start has completed
        if (this._hasPendingReaders()) {
          this.scheduler.log(`[VirtualStream] Start completed with pending readers, triggering pull`);
          this._triggerPull();
        }
      } catch (error) {
        this._pendingAsyncOps--;
        this._controller.error(error);
      }
    } else {
      this._startCompleted = true;
    }
  }

  getReader(): ReadableStreamDefaultReader<T>;
  getReader(options: { mode: 'byob' }): ReadableStreamBYOBReader;
  getReader(options?: ReadableStreamGetReaderOptions): ReadableStreamReader<T>;
  getReader(options?: ReadableStreamGetReaderOptions): ReadableStreamReader<T> {
    if (this._reader) {
      throw new TypeError('ReadableStream is already locked');
    }

    if (options?.mode === 'byob') {
      if (!(this._controller instanceof VirtualReadableByteStreamController)) {
        throw new TypeError('Cannot get BYOB reader for non-byte stream');
      }
      this._reader = new VirtualReadableStreamBYOBReader(this, this.scheduler);
    } else {
      this._reader = new VirtualReadableStreamDefaultReader<T>(this, this.scheduler);
    }

    (this as any).locked = true;
    return this._reader as any;
  }

  cancel(reason?: any): Promise<void> {
    this.scheduler.log(`[VirtualReadableStream.cancel] Called at tick ${this.scheduler.getCurrentTick()}`);
    if (this._cancelRequested) {
      return Promise.resolve();
    }

    this._cancelRequested = true;

    if (this._underlyingSource.cancel) {
      try {
        const result = this._underlyingSource.cancel(reason);
        return Promise.resolve(result);
      } catch (error) {
        return Promise.reject(error);
      }
    }

    return Promise.resolve();
  }

  values(options?: ReadableStreamIteratorOptions): ReadableStreamAsyncIterator<T> {
    // Simple implementation that creates an async iterator using getReader()
    const reader = this.getReader();
    return {
      async next(): Promise<IteratorResult<T>> {
        const result = await reader.read();
        if (result.done) {
          reader.releaseLock();
          return { done: true, value: undefined } as any;
        }
        return { done: false, value: result.value };
      },
      async return(): Promise<IteratorResult<T>> {
        try {
          await reader.cancel();
        } catch (e) { /* ignore */ }
        return { done: true, value: undefined } as any;
      },
      [Symbol.asyncIterator]() {
        return this;
      }
    } as ReadableStreamAsyncIterator<T>;
  }

  [Symbol.asyncIterator](): ReadableStreamAsyncIterator<T> {
    return this.values();
  }

  pipeThrough<U>(
    transform: { writable: WritableStream<T>; readable: ReadableStream<U> },
    options?: StreamPipeOptions
  ): ReadableStream<U> {
    // Schedule the piping operation in virtual time
    const reader = this.getReader();
    const writer = transform.writable.getWriter();

    // Async pipe operation
    this._schedulePipeOperation(reader, writer, options);

    return transform.readable;
  }

  pipeTo(destination: WritableStream<T>, options?: StreamPipeOptions): Promise<void> {
    const reader = this.getReader();
    const writer = destination.getWriter();

    return this._schedulePipeOperation(reader, writer, options);
  }

  tee(): [ReadableStream<T>, ReadableStream<T>] {
    if (this.locked) {
      throw new TypeError('ReadableStream is already locked');
    }

    const reader = this.getReader();

    // Create two new virtual streams
    const branch1 = new VirtualReadableStream<T>({}, {}, this.scheduler);
    const branch2 = new VirtualReadableStream<T>({}, {}, this.scheduler);

    // Schedule tee operation
    this._scheduleTeeOperation(reader, branch1, branch2);

    return [branch1, branch2];
  }

  // Internal pipe operation using virtual time
  private async _schedulePipeOperation(
    reader: ReadableStreamReader<T>,
    writer: WritableStreamDefaultWriter<T>,
    options?: StreamPipeOptions
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const pipeStep = async () => {
        try {
          const { done, value } = await (reader as any).read();
          if (done) {
            await writer.close();
            resolve();
            return;
          }

          await writer.write(value as T);

          // Schedule next step for next tick to avoid infinite loops
          this.scheduler['scheduleTask'](
            this.scheduler.getCurrentTick() + 1,
            pipeStep,
            'pipe-step',
            'consume'
          );
        } catch (error) {
          if (!options?.preventAbort) {
            await writer.abort(error);
          }
          reject(error);
        }
      };

      this.scheduler['scheduleTask'](
        this.scheduler.getCurrentTick() + 1,
        pipeStep,
        'pipe-start',
        'consume'
      );
    });
  }

  private _scheduleTeeOperation(
    reader: ReadableStreamReader<T>,
    branch1: VirtualReadableStream<T>,
    branch2: VirtualReadableStream<T>
  ): void {
    const teeStep = async () => {
      try {
        const result = await (reader as any).read() as ReadableStreamReadResult<T>;
        const { done, value } = result;
        if (done) {
          // Close branches immediately when upstream closes
          // This ensures termination happens at the same tick as upstream
          branch1._close();
          branch2._close();
          return;
        }

        branch1._enqueue(value as T);
        branch2._enqueue(value as T);

        // Schedule next step for the current tick to immediately process available data
        // Only advance to next tick if we need to wait for more data
        this.scheduler['scheduleTask'](
          this.scheduler.getCurrentTick(),
          teeStep,
          'tee-step',
          'consume'
        );
      } catch (error) {
        branch1._setError(error);
        branch2._setError(error);
      }
    };

    // Start immediately on current tick to avoid delaying the first read
    this.scheduler['scheduleTask'](
      this.scheduler.getCurrentTick(),
      teeStep,
      'tee-start',
      'consume'
    );
  }

  // Internal methods for immediate data availability
  _enqueue(chunk: T): void {
    if (!this._isClosed && !this._isErrored && !this._cancelRequested) {
      this._queue.push(chunk);
      this._notifyPendingReaders();
    }
  }

  _close(): void {
    this._isClosed = true;
    this._notifyPendingReaders();
  }

  _setError(e: any): void {
    this._isErrored = true;
    this._errorValue = e;
    this._notifyPendingReaders();
  }

  _notifyPendingReaders(): void {
    while (this._pendingReaders.length > 0) {
      const { resolve, reject } = this._pendingReaders.shift()!;

      if (this._hasData()) {
        const value = this._dequeue();
        resolve({ done: false, value });
      } else if (this._isStreamClosed()) {
        resolve({ done: true, value: undefined });
      } else if (this._isStreamErrored()) {
        reject(this._errorValue);
      } else {
        this._pendingReaders.unshift({ resolve, reject });
        break;
      }
    }
  }

  _addPendingReader(
    resolve: (result: ReadableStreamReadResult<T>) => void,
    reject: (error: any) => void
  ): void {
    this._pendingReaders.push({ resolve, reject });
  }

  _hasData(): boolean {
    return this._queue.length > 0;
  }

  _dequeue(): T | undefined {
    return this._queue.shift();
  }

  _isStreamClosed(): boolean {
    return this._isClosed;
  }

  _isStreamErrored(): boolean {
    return this._isErrored;
  }

  _getStreamError(): any {
    return this._errorValue;
  }

  _releaseLock(): void {
    this._reader = null;
    (this as any).locked = false;
  }

  _triggerPull(): void {
    // Don't trigger pull if start hasn't completed yet
    if (!this._startCompleted) {
      this.scheduler.log(`[VirtualStream] Skipping pull - start not completed yet`);
      return;
    }

    if (this._underlyingSource.pull) {
      try {
        this._pendingAsyncOps++;
        const result = this._underlyingSource.pull(this._controller as any);
        
        // Handle promise-returning pull
        if (result && typeof result.then === 'function') {
          result.then(
            () => {
              this._pendingAsyncOps--;
              this.scheduler.log(`[VirtualStream] Pull completed at tick ${this.scheduler.getCurrentTick()}`);
            },
            (error: any) => {
              this._pendingAsyncOps--;
              this._controller!.error(error);
            }
          );
        } else {
          this._pendingAsyncOps--;
        }
      } catch (error) {
        this._pendingAsyncOps--;
        this._controller!.error(error);
      }
    }
  }

  /**
   * Check if this stream has pending readers waiting for data or pending async operations
   * @internal Used by scheduler to determine if time advancement should continue
   */
  _hasPendingReaders(): boolean {
    return this._pendingReaders.length > 0 || this._pendingAsyncOps > 0;
  }
}

// ===== CONTROLLERS =====

export class VirtualReadableStreamDefaultController<T> implements ReadableStreamDefaultController<T> {
  readonly desiredSize: number | null = 1;

  constructor(
    private stream: any,
    private scheduler: VirtualTimeScheduler
  ) {
    if (scheduler == null) {
      throw new Error('VirtualTimeScheduler is required');
    }
  }

  close(): void {
    this.scheduler.log(`[VirtualController.close] Closing stream at tick ${this.scheduler.getCurrentTick()}`);
    this.stream._close();
  }

  enqueue(chunk: T): void {
    this.scheduler.log(`[VirtualController.enqueue] Enqueueing chunk at tick ${this.scheduler.getCurrentTick()}:`, chunk);
    this.stream._enqueue(chunk);
  }

  error(e?: any): void {
    this.scheduler.log(`[VirtualController.error] Erroring stream at tick ${this.scheduler.getCurrentTick()}:`, e);
    this.scheduler.log('[VirtualController.error] STACK TRACE:');
    this.scheduler.log(new Error("TRACE").stack);
    this.stream._setError(e);
  }
}

export class VirtualReadableByteStreamController implements ReadableByteStreamController {
  readonly byobRequest: ReadableStreamBYOBRequest | null = null;
  readonly desiredSize: number | null = 1;

  constructor(
    private stream: any,
    private scheduler: VirtualTimeScheduler
  ) {
    if (scheduler == null) {
      throw new Error('VirtualTimeScheduler is required');
    }
  }

  close(): void {
    this.stream._close();
  }

  enqueue(chunk: ArrayBufferView): void {
    this.stream._enqueue(chunk);
  }

  error(e?: any): void {
    this.stream._setError(e);
  }
}

// ===== READERS =====

export class VirtualReadableStreamDefaultReader<T> implements ReadableStreamDefaultReader<T> {
  readonly closed: Promise<undefined>;
  private streamId: string;

  constructor(
    private stream: any,
    private scheduler: VirtualTimeScheduler
  ) {
    if (scheduler == null) {
      throw new Error('VirtualTimeScheduler is required');
    }
    this.closed = Promise.resolve(undefined);
    this.streamId = `stream-${Math.random().toString(36).substr(2, 9)}`;
  }

  async read(): Promise<ReadableStreamReadResult<T>> {
    this.scheduler.log(`[VirtualReader.read] Called at tick ${this.scheduler.getCurrentTick()}`);
    // First, try immediate synchronous read
    if (this.stream._hasData()) {
      const value = this.stream._dequeue();
      this.scheduler.log(`[VirtualReader.read] Immediate read success:`, value);
      return { done: false, value };
    }

    if (this.stream._isStreamClosed() && !this.stream._hasData()) {
      this.scheduler.log(`[VirtualReader.read] Immediate read - stream closed`);
      return { done: true, value: undefined };
    }

    if (this.stream._isStreamErrored()) {
      this.scheduler.log(`[VirtualReader.read] Immediate read - stream errored`);
      throw this.stream._getStreamError();
    }

    // Trigger pull to potentially make data available immediately
    this.scheduler.log(`[VirtualReader.read] Triggering pull to get more data`);
    this.stream._triggerPull();

    // Check again after pull
    if (this.stream._hasData()) {
      const value = this.stream._dequeue();
      this.scheduler.log(`[VirtualReader.read] Post-pull read success:`, value);
      return { done: false, value };
    }

    if (this.stream._isStreamClosed() && !this.stream._hasData()) {
      this.scheduler.log(`[VirtualReader.read] Post-pull read - stream closed`);
      return { done: true, value: undefined };
    }

    if (this.stream._isStreamErrored()) {
      this.scheduler.log(`[VirtualReader.read] Post-pull read - stream errored`);
      throw this.stream._getStreamError();
    }

    // If still no data, we need to wait for it to be produced by virtual time progression
    // Return a promise that will be resolved when data becomes available
    this.scheduler.log(`[VirtualReader.read] No immediate data, adding pending reader`);
    return new Promise<ReadableStreamReadResult<T>>((resolve, reject) => {
      this.stream._addPendingReader(resolve, reject);
    });
  }

  cancel(reason?: any): Promise<void> {
    return this.stream.cancel(reason);
  }

  releaseLock(): void {
    this.stream._releaseLock();
  }
}

export class VirtualReadableStreamBYOBReader implements ReadableStreamBYOBReader {
  readonly closed: Promise<undefined>;

  constructor(
    private stream: any,
    private scheduler: VirtualTimeScheduler
  ) {
    this.closed = Promise.resolve(undefined);
  }

  async read<V extends ArrayBufferView>(view: V): Promise<ReadableStreamReadResult<V>> {
    // Basic BYOB implementation - for now, just return the view
    // In a full implementation, this would handle buffer management
    return this.stream.read();
  }

  cancel(reason?: any): Promise<void> {
    return this.stream.cancel(reason);
  }

  releaseLock(): void {
    this.stream._releaseLock();
  }
}

// ===== FACTORY FUNCTIONS =====

export function createVirtualStreamClasses(scheduler: VirtualTimeScheduler) {
  return {
    ReadableStream: class extends VirtualReadableStream {
      constructor(underlyingSource?: UnderlyingSource, strategy?: QueuingStrategy) {
        super(underlyingSource, strategy, scheduler);
      }
    } as unknown as ReadableStream
  };
}

// Legacy function for backward compatibility
export function createVirtualReadableStreamClass(scheduler: VirtualTimeScheduler) {
  return createVirtualStreamClasses(scheduler).ReadableStream;
}
