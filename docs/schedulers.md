## Schedulers

Schedulers control when and how stream operations are executed, allowing for better performance and resource management.

### IdleScheduler

A scheduler that uses `requestIdleCallback` when available (in browser environments), falling back to `setTimeout` for compatibility with Node.js and older browsers. Yields control during idle periods, allowing other tasks to run.

```ts
import { IdleScheduler, schedule } from 'web-streams-extensions';

const idleScheduler = new IdleScheduler();

let result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    schedule(idleScheduler) // Process values during idle time
  )
);
```

### FrameScheduler

A scheduler that uses `requestAnimationFrame` when available (in browser environments), falling back to `setTimeout` for compatibility with Node.js and older browsers. Synchronizes operations with the browser's rendering cycle, typically running at 60fps (16.67ms intervals). Ideal for animations, visual updates, and operations that should be synchronized with screen refreshes.

```ts
import { FrameScheduler, schedule } from 'web-streams-extensions';

const frameScheduler = new FrameScheduler();

// Perfect for animation data processing
let result = await toArray(
  pipe(
    from(animationKeyframes),
    schedule(frameScheduler) // Process keyframes at 60fps
  )
);

// Real-world animation example
const animationStream = pipe(
  interval(0),           // Fast source
  map(frame => ({
    frame,
    timestamp: performance.now(),
    position: calculatePosition(frame)
  })),
  schedule(frameScheduler), // Throttle to animation frames
  tap(({ position }) => updateUIElement(position)),
  takeUntil(animationComplete)
);
```

### Custom Schedulers

You can create custom schedulers by implementing the `IScheduler` interface:

```ts
import { IScheduler, schedule } from 'web-streams-extensions';

class CustomScheduler implements IScheduler {
  schedule(callback: () => void): void {
    // Custom scheduling logic - direct control over execution timing
    setTimeout(callback, 10);
  }
}

const customScheduler = new CustomScheduler();

// Use in stream pipeline
let result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    schedule(customScheduler) // Custom 10ms delay between values
  )
);
```
