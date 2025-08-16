/**
 * VIRTUAL TICK SCHEDULER
 * 
 * A comprehensive virtual time scheduling system for deterministic testing of asynchronous code.
 * Provides manual time progression, RxJS-style marble testing, and complete virtual timer integration.
 * 
 * Key Features:
 * - Manual time progression via discrete ticks
 * - Virtual ReadableStream implementation for marble testing
 * - Virtual setTimeout/setInterval that work with tick-based timing
 * - Task priority system (timer → emit → consume)
 * - Complete execution order tracking for debugging
 * - RxJS-style helper API for marble testing
 * 
 * @example
 * ```typescript
 * const scheduler = new VirtualTimeScheduler();
 * 
 * await scheduler.run(({ cold, hot, expectStream, time }) => {
 *   const source = cold('-a-b-|', { a: 1, b: 2 });
 *   expectStream(source).toBe('-a-b-|', { a: 1, b: 2 });
 * });
 * ```
 */

import { parseMarbles, parseTime, type MarbleEvent } from './parse-marbles.js';
import { createVirtualStreamClasses } from './virtual-streams.js';

/**
 * Represents a scheduled task in the virtual time system
 * @internal
 */
interface ScheduledTask {
  /** The tick at which this task should execute */
  tick: number;
  /** The type/priority of the task */
  stage: 'timer' | 'emit' | 'consume';
  /** The function to execute */
  callback: () => void;
  /** Human-readable description for debugging */
  description: string;
  /** Unique identifier for this task */
  id?: number;
}

/**
 * Represents information about a task that has been executed
 * Used for debugging and analysis of scheduler behavior
 */
interface ScheduledTaskEvent {
  /** The tick at which the task was executed */
  tick: number;
  /** The type/category of the task */
  type: 'timer' | 'emit' | 'consume';
  /** The name/identifier of the task */
  name: string;
  /** Additional descriptive information */
  description?: string;
  /** Global execution sequence number for ordering */
  executionOrder: number;
}

/**
 * Represents an async runner (like expectStream assertions)
 * @internal
 */
interface Runner {
  /** Unique identifier for the runner */
  id: string;
  /** The promise representing the async operation */
  promise: Promise<void>;
  /** Whether the runner has completed execution */
  completed: boolean;
}

/**
 * Virtual Time Scheduler for deterministic testing of time-dependent asynchronous code.
 * 
 * This scheduler provides complete control over time progression, allowing tests to advance
 * time manually in discrete ticks. It virtualizes setTimeout, setInterval, and ReadableStream
 * to work within the virtual time system.
 * 
 * @example Basic usage
 * ```typescript
 * const scheduler = new VirtualTimeScheduler();
 * 
 * await scheduler.run(() => {
 *   let fired = false;
 *   setTimeout(() => fired = true, 5);
 *   
 *   scheduler.scheduleTask(10, 'consume', () => {
 *     expect(fired).to.be.true; // Timer fired at tick 5
 *   });
 * });
 * ```
 * 
 * @example Marble testing
 * ```typescript
 * await scheduler.run(({ cold, expectStream }) => {
 *   const source = cold('-a-b-|', { a: 1, b: 2 });
 *   expectStream(source).toBe('-a-b-|', { a: 1, b: 2 });
 * });
 * ```
 */
export class VirtualTimeScheduler {
  /** Current virtual time tick. Each tick represents one unit of virtual time. */
  public currentTick = 0;
  
  /** @internal Array of tasks scheduled to run at future ticks */
  private scheduledTasks: ScheduledTask[] = [];
  
  /** @internal Array of async runners (expectStream, expectResult, etc.) */
  private runners: Runner[] = [];
  
  /** @internal Set of virtual streams for pending reader tracking */
  private virtualStreams: Set<any> = new Set();
  
  /** @internal Counter for generating unique runner IDs */
  private runnerId = 0;
  
  /** @internal Array tracking all executed tasks for debugging/analysis */
  private executedTasks: ScheduledTaskEvent[] = [];
  
  /** @internal Global counter for task execution ordering */
  private executionOrder = 0;

  /** @internal Counter for generating unique task IDs */
  private nextTaskId = 1;

  /** @internal Store original global functions for restoration */
  private originalSetTimeout?: typeof globalThis.setTimeout;
  /** @internal Store original global functions for restoration */
  private originalSetInterval?: typeof globalThis.setInterval;
  /** @internal Store original global functions for restoration */
  private originalClearTimeout?: typeof globalThis.clearTimeout;
  /** @internal Store original global functions for restoration */
  private originalClearInterval?: typeof globalThis.clearInterval;
  /** @internal Store original global functions for restoration */
  private originalSetImmediate?: typeof globalThis.setImmediate;
  /** @internal Store original global functions for restoration */
  private originalRequestIdleCallback?: typeof globalThis.requestIdleCallback;
  /** @internal Store original global functions for restoration */
  private originalCancelIdleCallback?: typeof globalThis.cancelIdleCallback;
  /** @internal Store original global functions for restoration */
  private originalReadableStream?: typeof globalThis.ReadableStream;

  /** @internal Map of active virtual timeouts */
  private virtualTimeouts = new Map<number, ScheduledTask>();
  /** @internal Map of active virtual intervals */
  private virtualIntervals = new Map<number, { interval: number; callback: () => void; task: ScheduledTask; cancelled: boolean }>();
  /** @internal Map of active virtual idle callbacks */
  private virtualIdleCallbacks = new Map<number, ScheduledTask>();
  /** @internal Counter for generating unique timer IDs */
  private nextTimerId = 1;

  private _debug = false;

  /**
   * Creates a new VirtualTimeScheduler instance.
   * 
   * The scheduler starts at tick 0 and requires manual time progression via run() or nextTick().
   * Global functions (setTimeout, setInterval, ReadableStream) are not modified until run() is called.
   */
  constructor(options?:{debug?:boolean}) {
    if (options?.debug) {
      this.setDebugging(options.debug);
    }
  }

  setDebugging(enabled: boolean): void {
    this._debug = enabled;
  }

  log(message: string, ...args: any[]): void {
    const sanitize = (arg: any): any => {
      try {
        // Prefer native instanceof when available
        if (typeof ReadableStream !== 'undefined' && arg instanceof (ReadableStream as any)) {
          return 'ReadableStream';
        }
      } catch {
        // ignore cross-realm instanceof errors
      }

      // Fallback duck-typing detection
      if (arg && typeof arg === 'object') {
        if (typeof arg.getReader === 'function' && typeof arg.tee === 'function') {
          return 'ReadableStream';
        }
      }

      if (Array.isArray(arg)) {
        return arg.map(sanitize);
      }

      return arg;
    };

    const safeArgs = args.map(sanitize);

    if (this._debug) {
      console.log(message, ...safeArgs);
    }
  }

  /**
   * Get the current virtual time tick.
   * 
   * This method provides compatibility with the virtual-streams.ts module and other
   * components that need to query the current virtual time.
   * 
   * @returns The current tick number (starts at 0)
   * 
   * @example
   * ```typescript
   * const scheduler = new VirtualTimeScheduler();
   * this.log(scheduler.getCurrentTick()); // 0
   * 
   * await scheduler.run(() => {
   *   this.log(scheduler.getCurrentTick()); // Still 0 until time advances
   * });
   * ```
   */
  getCurrentTick(): number {
    return this.currentTick;
  }

  /**
   * Schedule a task to run at a specific tick with a given priority stage.
   * 
   * Tasks are executed in priority order: timer → emit → consume within each tick.
   * Multiple tasks at the same tick and stage are executed in the order they were scheduled.
   * 
   * @param tick - The virtual time tick when the task should execute
   * @param stage - The priority stage of the task
   * @param callback - The function to execute
   * @param description - Optional human-readable description for debugging
   * 
   * @example
   * ```typescript
   * scheduler.scheduleTask(5, 'timer', () => this.log('Timer!'), 'my-timer');
   * scheduler.scheduleTask(5, 'emit', () => this.log('Emit!'), 'my-emit');
   * scheduler.scheduleTask(5, 'consume', () => this.log('Consume!'), 'my-consume');
   * // When tick 5 is processed: "Timer!" → "Emit!" → "Consume!"
   * ```
   */
  scheduleTask(tick: number, stage: 'timer' | 'emit' | 'consume', callback: () => void, description?: string): void;
  
  /**
   * Schedule a task to run at a specific tick (alternative signature for backwards compatibility).
   * 
   * @param tick - The virtual time tick when the task should execute
   * @param callback - The function to execute
   * @param description - Human-readable description for debugging
   * @param stage - The priority stage of the task
   */
  scheduleTask(tick: number, callback: () => void, description: string, stage: 'timer' | 'emit' | 'consume'): void;
  scheduleTask(tick: number, stageOrCallback: 'timer' | 'emit' | 'consume' | (() => void), callbackOrDescription: (() => void) | string, descriptionOrStage: string | 'timer' | 'emit' | 'consume' = ''): void {
    let stage: 'timer' | 'emit' | 'consume';
    let callback: () => void;
    let description: string;

    if (typeof stageOrCallback === 'function') {
      // New signature: scheduleTask(tick, callback, description, stage)
      callback = stageOrCallback;
      description = callbackOrDescription as string;
      stage = descriptionOrStage as 'timer' | 'emit' | 'consume';
    } else {
      // Current signature: scheduleTask(tick, stage, callback, description)
      stage = stageOrCallback;
      callback = callbackOrDescription as () => void;
      description = (descriptionOrStage as string) || '';
    }

    this.log(`[ScheduleTask] Scheduling ${stage} task for tick ${tick}: ${description} (current tick: ${this.currentTick})`);
    
    // Warn if scheduling a task for the current tick during tick processing
    if (tick === this.currentTick) {
      this.log(`[ScheduleTask] WARNING: Scheduling task for current tick ${tick} - this may cause infinite loops!`);
    }
    
    // Assign task ID synchronously to avoid timing issues
    const taskId = this.nextTaskId++;
    this.scheduledTasks.push({ tick, stage, callback, description, id: taskId });
    this.log(`[ScheduleTask] Assigned task ID ${taskId} to ${stage} task for tick ${tick}`);
  }

  /**
   * Create a virtual setTimeout that schedules tasks in ticks instead of milliseconds.
   * 
   * This replaces the global setTimeout with a version that works with virtual time.
   * The delay parameter represents ticks, not milliseconds.
   * 
   * @internal
   * @returns A virtual setTimeout function that schedules timer tasks
   * 
   * @example
   * ```typescript
   * // With virtual time, this schedules a task 5 ticks in the future
   * setTimeout(() => this.log('Hello'), 5);
   * ```
   */
  private createVirtualSetTimeout(): typeof globalThis.setTimeout {
    return ((callback: () => void, delayTicks: number = 0): number => {
      const id = this.nextTimerId++;
      const targetTick = this.currentTick + delayTicks;
      
      // Create task with ID assigned synchronously
      const taskId = this.nextTaskId++;
      const task: ScheduledTask = {
        tick: targetTick,
        stage: 'timer',
        callback,
        description: `setTimeout(${id}, ${delayTicks})`,
        id: taskId
      };
      
      this.virtualTimeouts.set(id, task);
      this.scheduledTasks.push(task);
      this.log(`[VirtualSetTimeout] Created timer ${id} (task ${taskId}) for tick ${targetTick} (delay: ${delayTicks})`);
      
      return id;
    }) as any;
  }

  /**
   * Create a virtual setInterval that works with tick-based timing.
   * 
   * This replaces the global setInterval with a version that schedules recurring
   * tasks at regular tick intervals in virtual time.
   * 
   * @internal
   * @returns A virtual setInterval function that schedules recurring timer tasks
   * 
   * @example
   * ```typescript
   * // Executes every 3 ticks
   * const id = setInterval(() => this.log('Tick'), 3);
   * ```
   */
  private createVirtualSetInterval(): typeof globalThis.setInterval {
    return ((callback: () => void, intervalTicks: number): number => {
      const id = this.nextTimerId++;
      
      const scheduleNext = () => {
        if(this.virtualIntervals.has(id) && this.virtualIntervals.get(id)?.cancelled) {
          this.log(`[VirtualSetInterval] Interval ${id} has been cleared, stopping further scheduling.`);
          return;
        }
        const nextTick = this.currentTick + intervalTicks;
        const task: ScheduledTask = {
          tick: nextTick,
          stage: 'timer',
          callback: () => {
            callback();
            scheduleNext(); // Schedule the next execution
          },
          description: `setInterval(${id}, ${intervalTicks})`
        };
        
        this.scheduleTask(nextTick, 'timer', task.callback, task.description);
        this.virtualIntervals.set(id, { interval: intervalTicks, callback, task, cancelled:false });
      };
      
      scheduleNext();
      this.log(`[VirtualSetInterval] Created interval ${id} with period ${intervalTicks} ticks`);
      return id;
    }) as any;
  }

  /**
   * Create a virtual clearTimeout that cancels virtual timer tasks.
   * 
   * @internal
   * @returns A virtual clearTimeout function that removes scheduled timer tasks
   */
  private createVirtualClearTimeout(): typeof globalThis.clearTimeout {
    return (id: number) => {
      const task = this.virtualTimeouts.get(id);
      if (task) {
        // Remove from scheduled tasks using the unique task ID
        const index = this.scheduledTasks.findIndex(t => t.id === task.id);
        this.log(`[VirtualClearTimeout] Timer ${id}: task found=${!!task}, task.id=${task.id}, index=${index}, scheduledTasks.length=${this.scheduledTasks.length}`);
        this.log(`[VirtualClearTimeout] All tasks: ${this.scheduledTasks.map((t, i) => `${i}:${t.stage}@${t.tick}:${t.description}(id=${t.id})`).join(', ')}`);
        
        if (index !== -1) {
          const removedTask = this.scheduledTasks.splice(index, 1)[0];
          this.log(`[VirtualClearTimeout] Removing task at index ${index}: ${removedTask.stage}@${removedTask.tick}:${removedTask.description}(id=${removedTask.id})`);
          this.log(`[VirtualClearTimeout] Removed task at index ${index}, new length=${this.scheduledTasks.length}`);
        } else {
          this.log(`[VirtualClearTimeout] WARNING: Task for timer ${id} (task.id=${task.id}) not found in scheduledTasks!`);
        }
        
        this.virtualTimeouts.delete(id);
        this.log(`[VirtualClearTimeout] Cleared timeout ${id}`);
      } else {
        this.log(`[VirtualClearTimeout] WARNING: Timer ${id} not found in virtualTimeouts!`);
      }
    };
  }

  /**
   * Create virtual clearInterval
   */
  private createVirtualClearInterval(): typeof globalThis.clearInterval {
    return (id: number) => {
      if (this.virtualIntervals.has(id)) {
        // Remove future executions by filtering out tasks with this description
        this.scheduledTasks = this.scheduledTasks.filter(task => 
          !task.description.includes(`setInterval(${id},`)
        );
        this.virtualIntervals.get(id).cancelled = true;
        //this.virtualIntervals.delete(id); // don't delete, just mark as cancelled
        this.log(`[VirtualClearInterval] Cancelled interval ${id}`);
      }
    };
  }

  /**
   * Create a virtual requestIdleCallback that schedules tasks with low priority.
   * 
   * This replaces the global requestIdleCallback with a version that works with virtual time.
   * Idle callbacks are scheduled as 'consume' tasks at the next tick.
   * 
   * @internal
   * @returns A virtual requestIdleCallback function that schedules low-priority tasks
   * 
   * @example
   * ```typescript
   * // With virtual time, this schedules a task for the next tick
   * requestIdleCallback(() => this.log('Idle work'));
   * ```
   */
  private createVirtualRequestIdleCallback(): typeof globalThis.requestIdleCallback {
    return ((callback: IdleRequestCallback, options?: IdleRequestOptions): number => {
      const id = this.nextTimerId++;
      const targetTick = this.currentTick + 1; // Next tick for idle work
      
      const task: ScheduledTask = {
        tick: targetTick,
        stage: 'consume', // Lowest priority
        callback: () => {
          const deadline = {
            didTimeout: false,
            timeRemaining: () => 50 // Mock 50ms remaining
          };
          callback(deadline);
        },
        description: `requestIdleCallback(${id})`
      };
      
      this.virtualIdleCallbacks.set(id, task);
      this.scheduleTask(targetTick, 'consume', task.callback, task.description);
      
      this.log(`[VirtualRequestIdleCallback] Created idle callback ${id} for tick ${targetTick}`);
      return id;
    }) as any;
  }

  /**
   * Create a virtual cancelIdleCallback that cancels virtual idle callback tasks.
   * 
   * @internal
   * @returns A virtual cancelIdleCallback function that removes scheduled idle tasks
   */
  private createVirtualCancelIdleCallback(): typeof globalThis.cancelIdleCallback {
    return (id: number) => {
      const task = this.virtualIdleCallbacks.get(id);
      if (task) {
        // Remove from scheduled tasks
        const index = this.scheduledTasks.indexOf(task);
        if (index !== -1) {
          this.scheduledTasks.splice(index, 1);
        }
        this.virtualIdleCallbacks.delete(id);
        this.log(`[VirtualCancelIdleCallback] Cancelled idle callback ${id}`);
      }
    };
  }

  /**
   * Replace global timer functions with virtual versions
   */
  private replaceGlobalTimers(): void {
    this.originalSetTimeout = globalThis.setTimeout;
    this.originalSetInterval = globalThis.setInterval;
    this.originalClearTimeout = globalThis.clearTimeout;
    this.originalClearInterval = globalThis.clearInterval;
    this.originalSetImmediate = globalThis.setImmediate;
    this.originalRequestIdleCallback = globalThis.requestIdleCallback;
    this.originalCancelIdleCallback = globalThis.cancelIdleCallback;

    // Store original setImmediate in global for use in flushCurrentTick
    (globalThis as any).__originalSetImmediate = this.originalSetImmediate;

    globalThis.setTimeout = this.createVirtualSetTimeout();
    globalThis.setInterval = this.createVirtualSetInterval();
    globalThis.clearTimeout = this.createVirtualClearTimeout();
    globalThis.clearInterval = this.createVirtualClearInterval();
    
    // Replace idle callback functions if they exist (browser-only)
    // If they don't exist (Node.js), don't create fallbacks per user request
    if (typeof globalThis.requestIdleCallback !== 'undefined') {
      globalThis.requestIdleCallback = this.createVirtualRequestIdleCallback();
    }
    if (typeof globalThis.cancelIdleCallback !== 'undefined') {
      globalThis.cancelIdleCallback = this.createVirtualCancelIdleCallback();
    }

    this.log('[ReplaceGlobalTimers] Virtual timer functions installed');
  }

  /**
   * Restore original global timer functions
   */
  private restoreGlobalTimers(): void {
    if (this.originalSetTimeout) globalThis.setTimeout = this.originalSetTimeout;
    if (this.originalSetInterval) globalThis.setInterval = this.originalSetInterval;
    if (this.originalClearTimeout) globalThis.clearTimeout = this.originalClearTimeout;
    if (this.originalClearInterval) globalThis.clearInterval = this.originalClearInterval;
    if (this.originalSetImmediate) globalThis.setImmediate = this.originalSetImmediate;
    if (this.originalRequestIdleCallback) globalThis.requestIdleCallback = this.originalRequestIdleCallback;
    if (this.originalCancelIdleCallback) globalThis.cancelIdleCallback = this.originalCancelIdleCallback;
    
    // Clean up global reference
    delete (globalThis as any).__originalSetImmediate;

    this.virtualTimeouts.clear();
    this.virtualIntervals.clear();
    this.virtualIdleCallbacks.clear();

    this.log('[RestoreGlobalTimers] Original timer functions restored');
  }

  /**
   * Replace ReadableStream with virtual version
   */
  private replaceReadableStream(): void {
    this.originalReadableStream = globalThis.ReadableStream;
    
    // Create a simple adapter for VirtualTimeScheduler2
    const scheduler2Adapter = {
      getCurrentTick: () => this.currentTick,
      scheduleTask: (tick: number, callback: () => void, description?: string) => {
        this.scheduleTask(tick, 'consume', callback, description || 'stream-task');
      },
      addVirtualStream: (stream: any) => this.addVirtualStream(stream),
      removeVirtualStream: (stream: any) => this.removeVirtualStream(stream),
      log: (message: string, ...args: any[]) => {this.log(message, ...args);},
      setDebugging: (enabled: boolean) => this.setDebugging(enabled)
    };
    
    const { ReadableStream: VirtualReadableStream } = createVirtualStreamClasses(scheduler2Adapter as any);
    globalThis.ReadableStream = VirtualReadableStream as any;
    this.log('[ReplaceReadableStream] Virtual ReadableStream installed');
  }

  /**
   * Restore original ReadableStream
   */
  private restoreReadableStream(): void {
    if (this.originalReadableStream) {
      globalThis.ReadableStream = this.originalReadableStream;
      this.log('[RestoreReadableStream] Original ReadableStream restored');
    }
  }

  /**
   * Register a virtual stream for pending reader tracking
   * @internal Used by virtual streams to register themselves
   */
  addVirtualStream(stream: any): void {
    this.virtualStreams.add(stream);
  }

  /**
   * Unregister a virtual stream
   * @internal Used by virtual streams to cleanup
   */
  removeVirtualStream(stream: any): void {
    this.virtualStreams.delete(stream);
  }

  /**
   * Check if any virtual streams have pending readers waiting for data
   * @internal Used by runRunners to determine if time advancement should continue
   */
  private hasPendingReaders(): boolean {
    for (const stream of this.virtualStreams) {
      if (stream._hasPendingReaders && stream._hasPendingReaders()) {
        return true;
      }
    }
    return false;
  }

  /**
   * Advance time by one tick and process all tasks for that tick
   */
  async nextTick(): Promise<void> {
    this.currentTick++;
    this.log(`[NextTick] Advanced to tick ${this.currentTick}`);
    await this.flushCurrentTick();
  }

  /**
   * Process all tasks scheduled for the current tick and any past ticks
   */
  async flushCurrentTick(): Promise<void> {
    this.log(`[FlushTick] Processing tick ${this.currentTick}`);

    // Keep flushing until nothing more happens at or before this tick
    let hasWork = true;
    let iterations = 0;
    const maxIterations = 100; // Prevent infinite loops
    
    while (hasWork && iterations < maxIterations) {
      iterations++;
      hasWork = false;
      
      // Get all tasks for this tick AND any past ticks that weren't executed
      // This handles the case where tasks are scheduled for tick 0 while we're at tick 1
      const relevantTasks = this.scheduledTasks
        .filter(task => task.tick <= this.currentTick)
        .sort((a, b) => {
          // First sort by tick (past ticks first), then by priority
          if (a.tick !== b.tick) {
            return a.tick - b.tick;
          }
          const stagePriority = { timer: 0, emit: 1, consume: 2 };
          return stagePriority[a.stage] - stagePriority[b.stage];
        });
      
      if (relevantTasks.length > 0) {
        hasWork = true;
        this.log(`[FlushTick] Iteration ${iterations}: Found ${relevantTasks.length} tasks at or before tick ${this.currentTick}`);
        
        // Execute tasks one at a time with re-evaluation after each
        for (const task of relevantTasks) {
          // Remove this specific task
          const taskIndex = this.scheduledTasks.indexOf(task);
          if (taskIndex !== -1) {
            this.scheduledTasks.splice(taskIndex, 1);
            
            const actualTick = Math.max(task.tick, 0); // Don't go below tick 0
            this.log(`[FlushTick] Executing ${task.stage} (scheduled for tick ${task.tick}): ${task.description}`);
            task.callback();
            
            // Track task execution with the actual execution tick
            this.executedTasks.push({
              tick: actualTick,
              type: task.stage,
              name: task.description,
              description: task.description,
              executionOrder: this.executionOrder++
            });
            
            // Critical: Use original setTimeout to ensure proper async settling
            // This allows the event loop to process any async operations triggered by the task
            await new Promise(resolve => {
              if (this.originalSetTimeout) {
                this.originalSetTimeout.call(globalThis, resolve, 1);
              } else {
                setTimeout(resolve, 1);
              }
            });
            
            // Check if executing this task created new tasks at or before current tick
            const newRelevantTasks = this.scheduledTasks.filter(t => t.tick <= this.currentTick);
            if (newRelevantTasks.length > 0) {
              this.log(`[FlushTick] ${newRelevantTasks.length} new tasks scheduled at or before tick ${this.currentTick}, re-evaluating`);
              break; // Restart the loop to re-sort all tasks
            }
          }
        }
      }
      
      // Final check: any new tasks scheduled for current or past ticks during execution?
      const finalCheck = this.scheduledTasks.filter(task => task.tick <= this.currentTick);
      if (finalCheck.length > 0) {
        hasWork = true;
        this.log(`[FlushTick] Additional tasks found for tick ${this.currentTick} or earlier during execution`);
      }
    }
    
    if (iterations >= maxIterations) {
      throw new Error(`FlushCurrentTick exceeded maximum iterations (${maxIterations}) at tick ${this.currentTick}`);
    }
    
    this.log(`[FlushTick] Tick ${this.currentTick} complete after ${iterations} iterations`);
  }

  /**
   * Add a runner to be executed during the test
   */
  addRunner(runnerFn: () => Promise<void>): void {
    const id = `runner-${++this.runnerId}`;
    this.log(`[AddRunner] Adding runner ${id}`);
    
    const runner: Runner = {
      id,
      promise: runnerFn().then(() => {
        this.log(`[RunnerComplete] Runner ${id} completed`);
        runner.completed = true;
      }).catch(err => {
        this.log(`[RunnerError] Runner ${id} failed:`, err);
        runner.completed = true;
        throw err;
      }),
      completed: false
    };
    
    this.runners.push(runner);
  }

  /**
   * Execute all runners, advancing time until they complete
   */
  private async runRunners(): Promise<void> {
    const maxIterations = 50;
    const maxTicks = 50; // Prevent advancing to absurdly high tick values
    let iterations = 0;
    const startTick = this.currentTick;
    
    this.log(`[RunRunners] Starting with ${this.runners.length} runners`);

    // Start all runners
    const runnerPromises = this.runners.map(runner => runner.promise);

    // Count completed runners
    const getCompletedCount = () => this.runners.filter(r => r.completed).length;
    let completedRunners = getCompletedCount();

    // Advance time until all runners complete
    while (iterations < maxIterations) {
      iterations++;
      
      // Check for runaway tick advancement
      if (this.currentTick - startTick > maxTicks) {
        throw new Error(`Time advancement exceeded maximum ticks (${maxTicks}). Current tick: ${this.currentTick}, started at: ${startTick}`);
      }
      
      this.log(`[RunRunners] Iteration ${iterations}, tick ${this.currentTick}, completed: ${completedRunners}/${this.runners.length}`);
      
      // Check if there are any tasks scheduled for current or future ticks
      const hasCurrentTasks = this.scheduledTasks.some(task => task.tick === this.currentTick);
      const hasFutureTasks = this.scheduledTasks.some(task => task.tick > this.currentTick);
      const hasPendingReaders = this.hasPendingReaders();
      
      this.log(`[RunRunners] Tasks: current=${hasCurrentTasks}, future=${hasFutureTasks}, pendingReaders=${hasPendingReaders}`);
      
      // Check if all runners completed AND there are no pending readers that could be served
      // Pending readers are only productive if there are future tasks that could emit to them
      if (completedRunners >= this.runners.length && hasPendingReaders && !hasFutureTasks) {
        this.log(`[RunRunners] All runners completed and pending readers have no future tasks, stopping time advancement`);
        break;
      }
      
      if (hasCurrentTasks) {
        // Process current tick without advancing time
        await this.flushCurrentTick();
      } else if (hasFutureTasks || (hasPendingReaders && completedRunners < this.runners.length)) {
        // For synchronous streams, give runners a chance to consume immediately available data
        // before advancing time. Only advance if no progress is made in the current iteration.
        if (this.currentTick === 0 && hasPendingReaders && !hasFutureTasks && iterations === 1) {
          this.log(`[RunRunners] Tick 0 with pending readers but no tasks - allowing synchronous consumption`);
          // Give a microtask for runners to process immediately available data
          await new Promise(resolve => setImmediate(resolve));
          // Update completed count to see if progress was made
          const newCompletedRunners = getCompletedCount();
          if (newCompletedRunners > completedRunners) {
            this.log(`[RunRunners] Synchronous consumption made progress: ${completedRunners} -> ${newCompletedRunners}`);
            completedRunners = newCompletedRunners;
            continue; // Continue without advancing time
          }
        }
        
        // Advance to next tick if there are future tasks OR if there are pending readers and runners still active
        await this.nextTick();
      } else {
        this.log(`[RunRunners] No more scheduled tasks and no active runners with pending readers, stopping time advancement`);
        break;
      }

      // Update completed count
      completedRunners = getCompletedCount();
    }

    this.log(`[RunRunners] Loop exited: iterations=${iterations}/${maxIterations}, completed=${completedRunners}/${this.runners.length}`);

    if (iterations >= maxIterations) {
      throw new Error(`Runner execution exceeded maximum iterations (${maxIterations})`);
    }

    // Wait for all runners to complete
    await Promise.all(runnerPromises);
    this.log(`[RunRunners] All runners completed`);
  }

  /**
   * Flush all scheduled tasks without advancing time (RxJS-style)
   */
  async flush(): Promise<void> {
    this.log('[Flush] Flushing all scheduled tasks');
    while (this.scheduledTasks.length > 0) {
      await this.nextTick();
    }
    this.log('[Flush] All tasks flushed');
  }

  /**
   * Run a test within the virtual time environment with RxJS-style marble testing helpers.
   * 
   * This is the main entry point for virtual time testing. It:
   * 1. Resets the scheduler state to a clean starting point
   * 2. Replaces global functions (setTimeout, setInterval, ReadableStream) with virtual versions
   * 3. Executes the test function with helpful marble testing utilities
   * 4. Runs all scheduled tasks and assertions to completion
   * 5. Restores original global functions
   * 
   * @param testFn - Test function that receives helpful marble testing utilities as parameters
   * 
   * @example Basic virtual time test
   * ```typescript
   * await scheduler.run(() => {
   *   let timerFired = false;
   *   setTimeout(() => timerFired = true, 5);
   *   
   *   scheduler.scheduleTask(10, 'consume', () => {
   *     expect(timerFired).to.be.true;
   *   });
   * });
   * ```
   * 
   * @example Marble testing with helpers
   * ```typescript
   * await scheduler.run(({ cold, hot, expectStream, time }) => {
   *   const source = cold('-a-b-|', { a: 1, b: 2 });
   *   expectStream(source).toBe('-a-b-|', { a: 1, b: 2 });
   *   
   *   const duration = time('-----|'); // 6 ticks
   *   expect(duration).to.equal(6);
   * });
   * ```
   * 
   * @example Flexible termination timing
   * ```typescript
   * await scheduler.run(({ cold, expectStream }) => {
   *   const source = cold('-a-b|');
   *   // Allow completion to occur ±1 tick from expected time
   *   expectStream(source, { strict: false }).toBe('-a-(b|)');
   * });
   * ```
   * 
   * @example Testing negative cases
   * ```typescript
   * await scheduler.run(({ cold, expectStream }) => {
   *   const source = cold('-a-b-|', { a: 1, b: 2 });
   *   
   *   // Test that wrong timing fails
   *   expectStream(source).toBe('--a-b-|').throws();
   *   
   *   // Test with error validation
   *   expectStream(source).toBe('-wrong-|').throws(err => {
   *     expect(err.message).to.include('Value mismatch');
   *   });
   * });
   * ```
   * 
   * @example Advanced testing with expectResult
   * ```typescript
   * await scheduler.run(({ cold, expectResult }) => {
   *   const source = cold('-a-b|', { a: 1, b: 2 });
   *   
   *   expectResult(source, (sequence, scheduled) => {
   *     // Analyze both stream events and scheduler task execution
   *     expect(sequence.length).to.equal(3); // 2 values + completion
   *     expect(scheduled.length).to.be.greaterThan(0); // Tasks executed
   *   });
   * });
   * ```
   */
  async run(testFn: (helpers: { 
    /**
     * Create a cold observable stream from marble diagram.
     * 
     * Cold streams don't emit until subscribed to. Values are emitted relative
     * to subscription time, making them perfect for testing operator behavior.
     * 
     * @param marbles - Marble diagram string (e.g., '-a-b-|')
     * @param values - Object mapping marble characters to values (e.g., { a: 1, b: 2 })
     * @param error - Error value to emit for '#' character
     * @returns A ReadableStream that emits according to the marble diagram
     * 
     * @example
     * ```typescript
     * const source = cold('-a-b-|', { a: 'hello', b: 'world' });
     * // Emits 'hello' at tick 1, 'world' at tick 3, completes at tick 5
     * ```
     */
    cold: <T>(marbles: string, values?: Record<string, T>, error?: any) => ReadableStream<T>;
    
    /**
     * Create a hot observable stream from marble diagram.
     * 
     * Hot streams emit regardless of subscription status. Use '^' to mark the
     * subscription point - only emissions after '^' will be received by subscribers.
     * 
     * @param marbles - Marble diagram string (e.g., '-a-^-b-|')  
     * @param values - Object mapping marble characters to values
     * @param error - Error value to emit for '#' character
     * @returns A ReadableStream that emits according to the marble diagram
     * 
     * @example
     * ```typescript
     * const source = hot('-a-^-b-|', { a: 'missed', b: 'received' });
     * // 'a' is emitted before subscription, 'b' is received at tick 2 after '^'
     * ```
     */
    hot: <T>(marbles: string, values?: Record<string, T>, error?: any) => ReadableStream<T>;
    
    /**
     * Assert that a stream matches an expected marble diagram.
     * 
     * This creates a runner that consumes the stream and compares the actual
     * emissions against the expected marble pattern. The assertion runs 
     * asynchronously as part of the virtual time execution.
     * 
     * @param stream - The ReadableStream to test
     * @param options - Optional configuration
     * @param options.strict - Whether to require exact termination timing (default: true)
     * @returns Object with toBe method for making the assertion and throws method for negative testing
     * 
     * @example Basic usage
     * ```typescript
     * const source = cold('-a-b-|', { a: 1, b: 2 });
     * expectStream(source).toBe('-a-b-|', { a: 1, b: 2 });
     * ```
     * 
     * @example Flexible termination timing
     * ```typescript
     * const source = cold('-a-b|');
     * expectStream(source, { strict: false }).toBe('-a-(b|)');
     * ```
     * 
     * @example Testing negative cases
     * ```typescript
     * const source = cold('-a-b-|', { a: 1, b: 2 });
     * expectStream(source).toBe('-a-c-|', { a: 1, c: 3 }).throws();
     * expectStream(source).toBe('-a-c-|').throws(err => {
     *   expect(err.message).to.include('Value mismatch');
     * });
     * ```
     */
    expectStream: <T>(stream: ReadableStream<T>, options?: { strict?: boolean }) => { 
      /**
       * Compare stream output against expected marble diagram.
       * 
       * @param expected - Expected marble diagram
       * @param values - Expected values for marble characters
       * @param error - Expected error value for '#' character
       * @returns Object with throws method for negative testing, or executes assertion immediately
       */
      toBe: (expected: string, values?: Record<string, T>, error?: any) => {
        /**
         * Specify that this assertion should throw an error and optionally validate the error.
         * 
         * Use this method to test that expectations fail as expected. Useful for validating
         * error conditions, timing mismatches, or value differences.
         * 
         * @param validator - Optional function to validate the thrown error
         * 
         * @example Basic negative testing
         * ```typescript
         * expectStream(source).toBe('-wrong-|').throws();
         * ```
         * 
         * @example Validating error details
         * ```typescript
         * expectStream(source).toBe('-a-b-|').throws(err => {
         *   expect(err.message).to.include('Timing mismatch');
         * });
         * ```
         */
        throws: (validator?: (error: Error) => void) => void;
      };
    };
    
    /**
     * Capture the complete execution sequence of a stream including scheduler task information.
     * 
     * This provides deep insight into both the stream's emission pattern and the
     * underlying scheduler tasks that were executed. Useful for debugging complex
     * timing scenarios and understanding scheduler behavior.
     * 
     * @param stream - The ReadableStream to analyze
     * @param cb - Callback that receives both stream events and scheduler tasks
     * 
     * @example
     * ```typescript
     * expectResult(source, (sequence, scheduled) => {
     *   // sequence: Array of stream events with timing
     *   expect(sequence[0]).to.deep.equal({ tick: 1, type: 'next', value: 'hello' });
     *   
     *   // scheduled: Array of scheduler tasks that were executed
     *   const emitTasks = scheduled.filter(task => task.type === 'emit');
     *   expect(emitTasks.length).to.equal(2);
     * });
     * ```
     */
    expectResult: <T>(stream: ReadableStream<T>, cb: (
      /** Array of stream events in chronological order */
      sequence: Array<{ tick: number; type: 'next' | 'complete' | 'error'; value?: T }>, 
      /** Array of scheduler tasks that were executed during stream consumption */
      scheduled: Array<ScheduledTaskEvent>
    ) => void) => void;
    
    /**
     * Calculate the duration (in ticks) of a marble diagram.
     * 
     * Useful for timing calculations and creating delays based on marble patterns.
     * Handles grouped emissions like '(ab)' correctly.
     * 
     * @param marbles - Marble diagram to measure
     * @returns The number of ticks represented by the marble diagram
     * 
     * @example
     * ```typescript
     * time('-a-b-|') // Returns 6
     * time('(ab)|')  // Returns 2  
     * time('---')    // Returns 3
     * ```
     */
    time: (marbles: string) => number;
    
    /**
     * Manually flush all pending tasks and advance time to completion.
     * 
     * This forces the scheduler to process all remaining tasks regardless of
     * their scheduled time. Useful for ensuring all async operations complete
     * before making final assertions.
     * 
     * @returns Promise that resolves when all tasks have been processed
     * 
     * @example
     * ```typescript
     * setTimeout(() => this.log('delayed'), 100);
     * await flush(); // Processes the timeout immediately
     * ```
     */
    flush: () => Promise<void>;
  }) => void | Promise<void>): Promise<void>;
  async run(testFn: any): Promise<void> {
    this.log('[Run] Starting test execution');
    
    // Reset state
    this.currentTick = 0;
    this.scheduledTasks = [];
    this.runners = [];
    this.executedTasks = [];
    this.executionOrder = 0;
    this.virtualTimeouts.clear();
    this.virtualIntervals.clear();
    this.nextTimerId = 1;

    // Replace global functions
    this.replaceGlobalTimers();
    this.replaceReadableStream();

    try {
      this.log('[Run] Executing test function');
      
      // Check if testFn expects helpers parameter
      if (testFn.length > 0) {
        // Provide RxJS-style helpers
        const helpers = {
          cold: <T>(marbles: string, values?: Record<string, T>, error?: any) => this.createCold<T>(marbles, values, error),
          hot: <T>(marbles: string, values?: Record<string, T>, error?: any) => this.createHot<T>(marbles, values, error),
          expectStream: <T>(stream: ReadableStream<T>, options?: { strict?: boolean }) => this.expectStream<T>(stream, options),
          expectResult: <T>(stream: ReadableStream<T>, cb: (sequence: Array<{ tick: number; type: 'next' | 'complete' | 'error'; value?: T }>, scheduled: Array<ScheduledTaskEvent>) => void) => this.expectResult<T>(stream, cb),
          time: (marbles: string) => parseTime(marbles),
          flush: () => this.flush()
        };
        await testFn(helpers);
      } else {
        // Original API
        await testFn();
      }
      
      this.log('[Run] Test function complete, running runners');
      await this.runRunners();
      
      this.log('[Run] All runners complete');
    } finally {
      // Always restore globals
      this.restoreGlobalTimers();
      this.restoreReadableStream();
      this.log('[Run] Test execution finished');
    }
  }

  /**
   * Create a cold observable stream from a marble diagram.
   * 
   * Cold streams are lazy - they don't emit values until someone subscribes to them.
   * When subscribed, they emit values relative to the subscription time, making them
   * ideal for testing operators and transformations.
   * 
   * Marble syntax:
   * - `-` represents one tick of time
   * - Letters (a, b, c, etc.) represent values to emit
   * - `|` represents completion
   * - `#` represents an error
   * - `()` groups emissions to occur at the same tick, e.g., `(ab)` emits both a and b at the same tick
   * 
   * @param marbles - Marble diagram string describing the emission pattern
   * @param values - Object mapping marble characters to their actual values
   * @param error - The error value to emit when '#' is encountered
   * @returns A ReadableStream that emits according to the marble diagram
   * 
   * @example Basic usage
   * ```typescript
   * const source = createCold('-a-b-|', { a: 1, b: 2 });
   * // When subscribed:
   * // - Tick 1: emits 1 (value 'a')
   * // - Tick 3: emits 2 (value 'b') 
   * // - Tick 5: completes
   * ```
   * 
   * @example With complex values
   * ```typescript
   * const source = createCold('--a--b|', { 
   *   a: { type: 'user', id: 1 }, 
   *   b: { type: 'user', id: 2 } 
   * });
   * ```
   * 
   * @example With errors
   * ```typescript
   * const source = createCold('-a-#', { a: 'value' }, new Error('Something went wrong'));
   * ```
   */
  createCold<T>(marbles: string, values?: Record<string, T>, error?: any): ReadableStream<T> {
    this.log(`[CreateCold] Creating cold stream: "${marbles}"`);
    const events = parseMarbles(marbles, values, error);
    let subscribed = false;
    
    return new ReadableStream<T>({
      start: (controller) => {
        this.log(`[CreateCold] Stream created for "${marbles}", waiting for subscription`);
      },
      pull: (controller) => {
        // Cold streams only start emitting when pulled (i.e., when subscribed to)
        if (!subscribed) {
          subscribed = true;
          const subscriptionTick = this.currentTick;
          this.log(`[CreateCold] Stream subscribed at tick ${subscriptionTick} for "${marbles}"`);
          
          for (const event of events) {
            // For cold streams, parseMarbles time should be offset by subscription time
            // If subscribed at tick 2, parseMarbles time 1 → absolute tick 3
            const targetTick = event.time + subscriptionTick;
            
            if (event.type === 'next') {
              this.scheduleTask(targetTick, 'emit', () => {
                this.log(`[CreateCold] Emitting value at tick ${targetTick} (parseMarbles time ${event.time}):`, event.value);
                controller.enqueue(event.value);
              }, `cold-emit-${event.time}`);
            } else if (event.type === 'complete') {
              this.scheduleTask(targetTick, 'emit', () => {
                this.log(`[CreateCold] Completing stream at tick ${targetTick} (parseMarbles time ${event.time})`);
                controller.close();
              }, `cold-complete-${event.time}`);
            } else if (event.type === 'error') {
              this.scheduleTask(targetTick, 'emit', () => {
                this.log(`[CreateCold] Error in stream at tick ${targetTick} (parseMarbles time ${event.time}):`, event.value);
                controller.error(event.value);
              }, `cold-error-${event.time}`);
            }
          }
        }
      }
    });
  }

  /**
   * Create a hot observable stream from a marble diagram.
   * 
   * Hot streams are eager - they emit values whether or not anyone is subscribed.
   * Use the '^' character to mark the subscription point. Only emissions that occur
   * after '^' will be received by subscribers.
   * 
   * Hot streams are useful for testing scenarios where events happen independently
   * of observation, such as user input, server-sent events, or shared observables.
   * 
   * Marble syntax:
   * - `-` represents one tick of time
   * - Letters (a, b, c, etc.) represent values to emit
   * - `|` represents completion
   * - `#` represents an error
   * - `^` marks the subscription point (only for hot streams)
   * - `()` groups emissions to occur at the same tick
   * 
   * @param marbles - Marble diagram string describing the emission pattern
   * @param values - Object mapping marble characters to their actual values
   * @param error - The error value to emit when '#' is encountered
   * @returns A ReadableStream that emits according to the marble diagram
   * 
   * @example Basic hot stream
   * ```typescript
   * const source = createHot('-a-b-|', { a: 1, b: 2 });
   * // Emits immediately regardless of subscription:
   * // - Tick 1: emits 1 (value 'a')
   * // - Tick 3: emits 2 (value 'b')
   * // - Tick 5: completes
   * ```
   * 
   * @example Hot stream with subscription point
   * ```typescript
   * const source = createHot('-a-^-b-|', { a: 1, b: 2 });
   * // Value 'a' emitted before subscription (missed)
   * // Subscriber receives: 'b' at tick 2, completes at tick 4
   * ```
   * 
   * @example Multiple subscribers to hot stream
   * ```typescript
   * const source = createHot('-a-b-c|', { a: 1, b: 2, c: 3 });
   * const [branch1, branch2] = source.tee();
   * // Both branches receive the same emissions
   * ```
   */
  createHot<T>(marbles: string, values?: Record<string, T>, error?: any): ReadableStream<T> {
    this.log(`[CreateHot] Creating hot stream: "${marbles}"`);
    const events = parseMarbles(marbles, values, error);
    let controller: ReadableStreamDefaultController<T>;
    
    const stream = new ReadableStream<T>({
      start: (ctrl) => {
        controller = ctrl;
        this.log(`[CreateHot] Stream started for "${marbles}"`);
      }
    });
    
    // Schedule events immediately (hot streams emit regardless of subscription)
    for (const event of events) {
      const targetTick = event.time;
      
      if (event.type === 'next') {
        this.scheduleTask(targetTick, 'emit', () => {
          this.log(`[CreateHot] Emitting value at tick ${targetTick}:`, event.value);
          controller.enqueue(event.value);
        }, `hot-emit-${event.time}`);
      } else if (event.type === 'complete') {
        this.scheduleTask(targetTick, 'emit', () => {
          this.log(`[CreateHot] Completing stream at tick ${targetTick}`);
          controller.close();
        }, `hot-complete-${event.time}`);
      } else if (event.type === 'error') {
        this.scheduleTask(targetTick, 'emit', () => {
          this.log(`[CreateHot] Error in stream at tick ${targetTick}:`, event.value);
          controller.error(event.value);
        }, `hot-error-${event.time}`);
      }
    }
    
    return stream;
  }

  /**
   * Create a marble diagram assertion for a ReadableStream
   * 
   * This method creates an expectation object that can test a ReadableStream against
   * a marble diagram pattern. The stream will be consumed using direct reading to
   * capture exact timing when values are read from the underlying stream.
   * 
   * @param stream - The ReadableStream to test
   * @param options - Optional configuration
   * @param options.strict - Whether to require exact termination timing (default: true)
   *   When false, allows termination events to occur ±1 tick from expected time
   * @returns An expectation object with toBe method for marble assertions and throws for negative testing
   * 
   * @example Basic marble assertion
   * ```typescript
   * const source = cold('-a-b-|', { a: 1, b: 2 });
   * expectStream(source).toBe('-a-b-|', { a: 1, b: 2 });
   * ```
   * 
   * @example With error testing
   * ```typescript
   * const errorSource = cold('-a-#', { a: 1 }, new Error('test'));
   * expectStream(errorSource).toBe('-a-#', { a: 1 }, new Error('test'));
   * ```
   * 
   * @example With flexible termination timing
   * ```typescript
   * const flexSource = cold('-a-b|');
   * expectStream(flexSource, { strict: false }).toBe('-a-(b|)');
   * ```
   * 
   * @example Testing negative cases
   * ```typescript
   * const source = cold('-a-b-|', { a: 1, b: 2 });
   * expectStream(source).toBe('-wrong-|').throws();
   * expectStream(source).toBe('-a-c-|').throws(err => {
   *   expect(err.message).to.include('Value mismatch');
   * });
   * ```
   */
  expectStream<T>(stream: ReadableStream<T>, options: { strict?: boolean } = {}) {
    return {
      /**
       * Assert that the stream matches the given marble diagram
       * 
       * This method compares the actual stream emissions against the expected marble
       * diagram pattern. It can be chained with the throws() method for negative testing.
       * 
       * @param expected - Marble diagram string (e.g., '-a-b-|', '--a-#')
       * @param values - Optional mapping of marble letters to actual values
       * @param error - Optional error value for error marble (#)
       * @returns Object with throws method for negative testing, or executes assertion immediately
       * 
       * @example Basic assertions
       * ```typescript
       * toBe('-a-b-|', { a: 1, b: 2 }); // Values at ticks 1, 3, complete at 5
       * toBe('--#', undefined, new Error('fail')); // Error at tick 2
       * toBe('(ab|)', { a: 1, b: 2 }); // Grouped emission at tick 0
       * ```
       * 
       * @example Negative testing
       * ```typescript
       * toBe('-wrong-|').throws(); // Expect this assertion to fail
       * toBe('-a-c-|').throws(err => {
       *   expect(err.message).to.include('Value mismatch');
       * });
       * ```
       */
      toBe: (expected: string, values?: Record<string, T>, error?: any) => {
        let shouldThrow = false;
        let errorValidator: ((error: Error) => void) | undefined = undefined;

        const executeAssertion = () => {
          this.addRunner(async () => {
            this.log(`[ExpectStream] Starting assertion for: "${expected}"`);
            const expectedEvents = parseMarbles(expected, values, error);
            const actualEvents: Array<{ tick: number; type: 'next' | 'complete' | 'error'; value?: T; error?: any }> = [];
            
            let readStartTick = this.currentTick;
            this.log(`[ExpectStream] Starting consumption at tick ${readStartTick}`);
            
            // Use direct reading to capture exact timing when values are read
            const reader = stream.getReader();
            
            let assertionError: Error | undefined = undefined;
            
            try {
              while (true) {
                const result = await reader.read();
                const currentTick = this.currentTick;
                const relativeTick = currentTick - readStartTick;
                
                if (result.done) {
                  actualEvents.push({ tick: relativeTick, type: 'complete' });
                  this.log(`[ExpectStream] Stream completed at relative tick ${relativeTick}`);
                  break;
                } else {
                  actualEvents.push({ tick: relativeTick, type: 'next', value: result.value });
                  this.log(`[ExpectStream] Value consumed at relative tick ${relativeTick}:`, result.value);
                }
              }
            } catch (streamError) {
              const relativeTick = this.currentTick - readStartTick;
              actualEvents.push({ tick: relativeTick, type: 'error', value: streamError });
              this.log(`[ExpectStream] Error consumed at relative tick ${relativeTick}:`, streamError);
            } finally {
              reader.releaseLock();
            }
            
            // Compare actual vs expected
            this.log(`[ExpectStream] Comparing events:`);
            this.log(`  Expected:`, expectedEvents);
            this.log(`  Actual:`, actualEvents);
            
            try {
              const strict = options.strict !== false; // Default to true
              
              // Helper function to create verbose error message with expected/actual events
              const createVerboseError = (primaryMessage: string): string => {
                const expectedStr = expectedEvents.map(e => `  tick ${e.time}: ${e.type}${e.value !== undefined ? ` (${JSON.stringify(e.value)})` : ''}`).join('\n');
                const actualStr = actualEvents.map(e => `  tick ${e.tick}: ${e.type}${e.value !== undefined ? ` (${JSON.stringify(e.value)})` : ''}`).join('\n');
                return `${primaryMessage}\n\nExpected events:\n${expectedStr}\n\nActual events:\n${actualStr}`;
              };
              
              if (actualEvents.length !== expectedEvents.length) {
                throw new Error(createVerboseError(`Event count mismatch: expected ${expectedEvents.length}, got ${actualEvents.length}`));
              }
              
              for (let i = 0; i < expectedEvents.length; i++) {
                const expected = expectedEvents[i];
                const actual = actualEvents[i];
                
                // Check timing - with special handling for termination events when strict is false
                const isLastEvent = i === expectedEvents.length - 1;
                const isTerminationEvent = actual.type === 'complete' || actual.type === 'error';
                const allowFlexibleTermination = !strict && isLastEvent && isTerminationEvent;
                
                if (allowFlexibleTermination) {
                  // For flexible termination, allow the termination event to occur at expected time ±1 tick
                  const expectedTick = expected.time;
                  const minAllowedTick = expectedTick - 1;
                  const maxAllowedTick = expectedTick + 1;
                  
                  if (actual.tick < minAllowedTick || actual.tick > maxAllowedTick) {
                    throw new Error(createVerboseError(`Flexible termination timing violation at event ${i}: termination at tick ${actual.tick} should be between ${minAllowedTick} and ${maxAllowedTick} (expected ${expectedTick} ±1)`));
                  }
                } else {
                  // Strict timing check for all other events
                  if (actual.tick !== expected.time) {
                    throw new Error(createVerboseError(`Timing mismatch at event ${i}: expected tick ${expected.time}, got ${actual.tick}`));
                  }
                }
                
                if (actual.type !== expected.type) {
                  throw new Error(createVerboseError(`Type mismatch at event ${i}: expected ${expected.type}, got ${actual.type}`));
                }
                
                if (expected.type === 'next') {
                  // Deep compare values for next events
                  if (!this.deepEqual(actual.value, expected.value)) {
                    throw new Error(createVerboseError(`Value mismatch at event ${i}: expected ${JSON.stringify(expected.value)}, got ${JSON.stringify(actual.value)}`));
                  }
                }
                
                if (expected.type === 'error') {
                  // Compare error objects by message if both are Error objects, otherwise direct comparison
                  const expectedError = expected.value;
                  const actualError = actual.value;
                  
                  if (expectedError instanceof Error && actualError instanceof Error) {
                    if (expectedError.message !== actualError.message) {
                      throw new Error(createVerboseError(`Error message mismatch at event ${i}: expected "${expectedError.message}", got "${actualError.message}"`), { cause: actualError });
                    }
                  } else if (expectedError !== actualError) {
                    throw new Error(createVerboseError(`Error value mismatch at event ${i}: expected ${expectedError}, got ${actualError}`), { cause: actualError });
                  }
                }
              }
              
              this.log(`[ExpectStream] Assertion passed for: "${expected}"`);
              
              // If we expected an error but didn't get one
              if (shouldThrow) {
                throw new Error(`Expected assertion to throw an error, but it passed`);
              }
            } catch (err) {
              assertionError = err as Error;
              
              if (shouldThrow) {
                this.log(`[ExpectStream] Assertion correctly threw error: ${assertionError.message}`);
                
                // If an error validator was provided, run it
                if (errorValidator) {
                  errorValidator(assertionError);
                }
                
                // The error was expected, so don't re-throw
                return;
              } else {
                // The error was not expected, re-throw it
                throw assertionError;
              }
            }
          });
        };

        // For backward compatibility, execute immediately if .throws() is not called
        // We'll use a microtask to delay this so .throws() can be chained
        const result = {
          /**
           * Specify that this assertion should throw an error and optionally validate the error
           * 
           * @param validator - Optional function to validate the thrown error
           * 
           * @example
           * ```typescript
           * expectStream(stream).toBe('-a-b-|').throws();
           * expectStream(stream).toBe('-a-b-|').throws(err => {
           *   expect(err.message).to.include('Timing mismatch');
           * });
           * ```
           */
          throws: (validator?: (error: Error) => void) => {
            shouldThrow = true;
            errorValidator = validator;
            executeAssertion();
          }
        };

        // Schedule execution for next microtask if .throws() is not called
        Promise.resolve().then(() => {
          if (!shouldThrow) {
            executeAssertion();
          }
        });

        return result;
      }
    };
  }

  /**
   * Capture the complete sequence of events from a stream and pass to callback for validation
   */
  expectResult<T>(stream: ReadableStream<T>, cb: (sequence: Array<{ tick: number; type: 'next' | 'complete' | 'error'; value?: T }>, scheduled: Array<ScheduledTaskEvent>) => void): void {
    this.addRunner(async () => {
      const capturedEvents: Array<{ tick: number; type: 'next' | 'complete' | 'error'; value?: T }> = [];
      
      let readStartTick = this.currentTick;
      const tasksAtStart = [...this.executedTasks]; // Snapshot of tasks before this stream starts
      this.log(`[ExpectResult] Starting consumption at tick ${readStartTick}`);
      
      // Use direct reading instead of piping to capture correct timing
      const reader = stream.getReader();
      
      try {
        while (true) {
          const result = await reader.read();
          const currentTick = this.currentTick;
          const relativeTick = currentTick - readStartTick;
          
          if (result.done) {
            capturedEvents.push({ tick: relativeTick, type: 'complete' });
            this.log(`[ExpectResult] Stream completed at relative tick ${relativeTick}`);
            break;
          } else {
            capturedEvents.push({ tick: relativeTick, type: 'next', value: result.value });
            this.log(`[ExpectResult] Value consumed at relative tick ${relativeTick}:`, result.value);
          }
        }
      } catch (error) {
        const relativeTick = this.currentTick - readStartTick;
        capturedEvents.push({ tick: relativeTick, type: 'error', value: error });
        this.log(`[ExpectResult] Error consumed at relative tick ${relativeTick}:`, error);
      } finally {
        reader.releaseLock();
      }

      // Get all tasks that were executed during this stream's lifetime
      const streamTasks = this.executedTasks.slice(tasksAtStart.length);
      
      // Adjust task ticks to be relative to stream start
      const relativeStreamTasks = streamTasks.map(task => ({
        ...task,
        tick: task.tick - readStartTick
      }));
      
      this.log(`[ExpectResult] Consumption completed, calling callback with events:`, capturedEvents);
      this.log(`[ExpectResult] Stream tasks (${relativeStreamTasks.length}):`, relativeStreamTasks);
      cb(capturedEvents, relativeStreamTasks);
    });
  }

  /**
   * Parse timing from marble diagram (alias to parseTime)
   */
  time(marbles: string): number {
    return parseTime(marbles);
  }

  /**
   * Create multiple cold streams at once (convenience method)
   */
  createColdStreams<T>(definitions: Record<string, { marble: string; values?: Record<string, T>; error?: any }>): Record<string, ReadableStream<T>> {
    const streams: Record<string, ReadableStream<T>> = {};
    for (const [key, def] of Object.entries(definitions)) {
      streams[key] = this.createCold<T>(def.marble, def.values, def.error);
    }
    return streams;
  }

  /**
   * Create multiple hot streams at once (convenience method)
   */
  createHotStreams<T>(definitions: Record<string, { marble: string; values?: Record<string, T>; error?: any }>): Record<string, ReadableStream<T>> {
    const streams: Record<string, ReadableStream<T>> = {};
    for (const [key, def] of Object.entries(definitions)) {
      streams[key] = this.createHot<T>(def.marble, def.values, def.error);
    }
    return streams;
  }

  /**
   * Deep equality comparison for values (handles arrays, objects, primitives)
   */
  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    
    if (a == null || b == null) return a === b;
    
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!this.deepEqual(a[i], b[i])) return false;
      }
      return true;
    }
    
    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      for (const key of keysA) {
        if (!keysB.includes(key) || !this.deepEqual(a[key], b[key])) return false;
      }
      return true;
    }
    
    return false;
  }
}
