# schedule

Controls the timing of stream emission using a scheduler. Allows yielding control to other tasks or synchronizing with specific timing patterns.

## Type Signature

```typescript
function schedule<T>(scheduler: IScheduler): (
  src: ReadableStream<T>, 
  strategy?: QueuingStrategy<T>
) => ReadableStream<T>
```

## Parameters

- `scheduler`: An object implementing `IScheduler` interface with a `schedule(callback)` method
- `strategy`: Optional queuing strategy for backpressure control

## How It Works

The operator:
1. **Delegates timing**: Uses the scheduler to control when each value is emitted
2. **Maintains order**: Values are emitted in the same order as received
3. **Yields control**: Allows other tasks to run between emissions
4. **Backpressure aware**: Respects downstream consumer speed

## Examples

### Basic Idle Scheduling

```typescript
import { IdleScheduler } from 'web-streams-extensions/schedulers';

const scheduled = pipe(
  from([1, 2, 3, 4, 5]),
  schedule(new IdleScheduler())
);

const result = await toArray(scheduled);
// Result: [1, 2, 3, 4, 5]
// Emitted during browser idle time
```

### Frame-Based Scheduling

```typescript
import { FrameScheduler } from 'web-streams-extensions/schedulers';

const animationData = pipe(
  from(animationFrames),
  map(frame => processFrame(frame)),
  schedule(new FrameScheduler()) // Sync with animation frames
);

// Perfect for animation processing at 60fps
```

### Custom Scheduler

```typescript
class DelayScheduler implements IScheduler {
  constructor(private delay: number) {}
  
  schedule(callback: () => void): void {
    setTimeout(callback, this.delay);
  }
}

const delayed = pipe(
  from(['fast', 'data', 'stream']),
  schedule(new DelayScheduler(100)) // 100ms delay between items
);
```

### Batch Processing

```typescript
class BatchScheduler implements IScheduler {
  private queue: (() => void)[] = [];
  private processing = false;

  schedule(callback: () => void): void {
    this.queue.push(callback);
    if (!this.processing) {
      this.processBatch();
    }
  }

  private async processBatch(): Promise<void> {
    this.processing = true;
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, 5); // Process 5 at a time
      batch.forEach(callback => callback());
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    this.processing = false;
  }
}

const batched = pipe(
  from(largeDataSet),
  schedule(new BatchScheduler())
);
```

### CPU Throttling

```typescript
class ThrottledScheduler implements IScheduler {
  private lastExecution = 0;
  private minInterval = 16; // ~60fps

  schedule(callback: () => void): void {
    const now = performance.now();
    const timeSinceLastExecution = now - this.lastExecution;
    
    if (timeSinceLastExecution >= this.minInterval) {
      this.lastExecution = now;
      callback();
    } else {
      setTimeout(() => {
        this.lastExecution = performance.now();
        callback();
      }, this.minInterval - timeSinceLastExecution);
    }
  }
}

const throttled = pipe(
  highFrequencyData,
  schedule(new ThrottledScheduler())
);
```

### Priority Scheduling

```typescript
class PriorityScheduler implements IScheduler {
  private highPriorityQueue: (() => void)[] = [];
  private normalQueue: (() => void)[] = [];

  schedule(callback: () => void): void {
    // Add logic to determine priority
    this.normalQueue.push(callback);
    this.processQueues();
  }

  scheduleHighPriority(callback: () => void): void {
    this.highPriorityQueue.push(callback);
    this.processQueues();
  }

  private processQueues(): void {
    requestIdleCallback(() => {
      // Process high priority first
      while (this.highPriorityQueue.length > 0) {
        const callback = this.highPriorityQueue.shift()!;
        callback();
      }
      // Then normal priority
      if (this.normalQueue.length > 0) {
        const callback = this.normalQueue.shift()!;
        callback();
      }
    });
  }
}
```

### Heavy Processing with Yielding

```typescript
const heavyProcessing = pipe(
  from(complexDataSet),
  map(data => expensiveComputation(data)),
  schedule(new IdleScheduler()), // Yield between computations
  map(result => furtherProcessing(result))
);

// Prevents blocking the main thread
```

## Built-in Schedulers

### IdleScheduler
Uses `requestIdleCallback` (browser) or `setTimeout` (Node.js) to yield during idle time:

```typescript
const idle = new IdleScheduler();
// Processes items when the browser/system is idle
```

### FrameScheduler  
Uses `requestAnimationFrame` (browser) or `setTimeout` (Node.js) for animation-synchronized processing:

```typescript
const frame = new FrameScheduler();
// Processes items at 60fps, synchronized with screen refresh
```

## Key Characteristics

- **Timing control**: Complete control over when values are emitted
- **Non-blocking**: Allows yielding control to other tasks
- **Order preserving**: Maintains value order despite timing changes
- **Scheduler agnostic**: Works with any scheduler implementation
- **Performance tool**: Helps manage CPU usage and responsiveness

## Use Cases

- **Animation**: Synchronize processing with animation frames
- **CPU management**: Prevent blocking the main thread
- **Performance optimization**: Yield control during heavy processing
- **Rate limiting**: Control emission frequency
- **Priority management**: Implement priority-based processing
- **Batch processing**: Group operations for efficiency

## Comparison with Related Operators

- **`schedule`**: Controls timing with pluggable schedulers
- **`delay`**: Fixed delay for all emissions
- **`throttleTime`**: Rate limiting with fixed intervals
- **`debounceTime`**: Emission after quiet periods

## See Also

- [Schedulers](../schedulers.md) - Available scheduler implementations
- [`delay`](./delay.md) - Fixed delay for emissions
- [`throttleTime`](./throttleTime.md) - Rate limiting operator
- [`debounceTime`](./debounceTime.md) - Debouncing operator