# withLatestFrom

Combines each value from the source stream with the latest values from other streams. Only emits when the source stream emits, and only if all other streams have emitted at least once.

## Type Signature

```typescript
// Single other stream
function withLatestFrom<T, A>(
  other: ReadableStream<A>
): (src: ReadableStream<T>, strategy?: QueuingStrategy<[T, A]>) => ReadableStream<[T, A]>

// Two other streams  
function withLatestFrom<T, A, B>(
  otherA: ReadableStream<A>,
  otherB: ReadableStream<B>
): (src: ReadableStream<T>, strategy?: QueuingStrategy<[T, A, B]>) => ReadableStream<[T, A, B]>

// Three other streams
function withLatestFrom<T, A, B, C>(
  otherA: ReadableStream<A>,
  otherB: ReadableStream<B>,
  otherC: ReadableStream<C>
): (src: ReadableStream<T>, strategy?: QueuingStrategy<[T, A, B, C]>) => ReadableStream<[T, A, B, C]>
```

## Parameters

- `...others`: One or more streams to combine with the source. The latest value from each is used.

## Examples

### Basic Combination with User State

```typescript
const buttonClicks = from([
  { type: 'save', timestamp: 100 },
  { type: 'edit', timestamp: 200 },
  { type: 'delete', timestamp: 300 }
]);

const userState = from([
  { id: 'user1', role: 'admin' },
  { id: 'user2', role: 'editor' }
]);

const result = await toArray(
  pipe(
    buttonClicks,
    withLatestFrom(userState),
    map(([click, state]) => ({ 
      action: click.type, 
      user: state.id, 
      authorized: state.role === 'admin' 
    }))
  )
);
// Only emits when button is clicked, with current user state
// Result: Actions with user context
```

### Form Submission with Validation

```typescript
const formSubmissions = from([
  { field: 'email', value: 'user@example.com' },
  { field: 'password', value: 'secret123' }
]);

const validationState = from([
  { email: false, password: false },
  { email: true, password: false },
  { email: true, password: true }
]);

const userPreferences = from([
  { theme: 'light', notifications: true },
  { theme: 'dark', notifications: false }
]);

const result = await toArray(
  pipe(
    formSubmissions,
    withLatestFrom(validationState, userPreferences),
    map(([form, validation, prefs]) => ({
      submission: form,
      isValid: validation[form.field],
      userSettings: prefs
    }))
  )
);
// Combines form data with latest validation and user preferences
```

### Mouse Events with Window State

```typescript
const mouseClicks = from([
  { x: 100, y: 200, button: 'left' },
  { x: 150, y: 250, button: 'right' },
  { x: 200, y: 300, button: 'left' }
]);

const windowState = from([
  { width: 1920, height: 1080, zoom: 1.0 },
  { width: 1600, height: 900, zoom: 1.2 }
]);

const result = await toArray(
  pipe(
    mouseClicks,
    withLatestFrom(windowState),
    map(([click, window]) => ({
      clickPosition: { x: click.x, y: click.y },
      relativePosition: { 
        x: click.x / window.width, 
        y: click.y / window.height 
      },
      button: click.button,
      zoom: window.zoom
    }))
  )
);
// Mouse clicks with window context for responsive handling
```

### API Requests with Authentication

```typescript
const apiRequests = from([
  { endpoint: '/users', method: 'GET' },
  { endpoint: '/posts', method: 'POST' },
  { endpoint: '/settings', method: 'PUT' }
]);

const authState = from([
  { token: null, expired: true },
  { token: 'abc123', expired: false },
  { token: 'def456', expired: false }
]);

const result = await toArray(
  pipe(
    apiRequests,
    withLatestFrom(authState),
    map(([request, auth]) => ({
      ...request,
      headers: {
        'Authorization': auth.expired ? 'Bearer refresh-needed' : `Bearer ${auth.token}`,
        'Content-Type': 'application/json'
      },
      authenticated: !auth.expired
    }))
  )
);
// API requests with current authentication context
```

### Game Actions with Player State

```typescript
const playerActions = from([
  { action: 'move', direction: 'north' },
  { action: 'attack', target: 'enemy1' },
  { action: 'use', item: 'potion' }
]);

const playerStats = from([
  { health: 100, mana: 50, level: 1 },
  { health: 80, mana: 60, level: 1 },
  { health: 90, mana: 40, level: 2 }
]);

const worldState = from([
  { time: 'day', weather: 'clear' },
  { time: 'night', weather: 'rain' }
]);

const result = await toArray(
  pipe(
    playerActions,
    withLatestFrom(playerStats, worldState),
    map(([action, stats, world]) => ({
      action: action.action,
      canPerform: validateAction(action, stats, world),
      player: stats,
      environment: world,
      timestamp: Date.now()
    }))
  )
);

function validateAction(action: any, stats: any, world: any): boolean {
  if (action.action === 'attack' && stats.mana < 10) return false;
  if (action.action === 'use' && stats.health === 100) return false;
  return true;
}
// Game actions with full context validation
```

### Sensor Data with Calibration

```typescript
const sensorReadings = interval(500).pipe(
  map(i => ({ 
    temperature: 20 + Math.random() * 10, 
    reading: i,
    timestamp: Date.now() 
  })),
  take(8)
);

const calibrationData = from([
  { offset: 0, multiplier: 1.0, calibrated: false },
  { offset: -2.5, multiplier: 1.1, calibrated: true }
]);

const result = await toArray(
  pipe(
    sensorReadings,
    withLatestFrom(calibrationData),
    map(([reading, calibration]) => ({
      raw: reading.temperature,
      calibrated: calibration.calibrated 
        ? (reading.temperature + calibration.offset) * calibration.multiplier
        : reading.temperature,
      timestamp: reading.timestamp,
      readingNumber: reading.reading
    }))
  )
);
// Sensor readings with real-time calibration applied
```

### Shopping Cart with Pricing

```typescript
const cartActions = from([
  { action: 'add', productId: 'laptop', quantity: 1 },
  { action: 'add', productId: 'mouse', quantity: 2 },
  { action: 'remove', productId: 'laptop', quantity: 1 }
]);

const currentPrices = from([
  { laptop: 999, mouse: 25, keyboard: 75 },
  { laptop: 899, mouse: 20, keyboard: 80 }, // Price update
]);

const discountState = from([
  { active: false, percentage: 0 },
  { active: true, percentage: 10 } // Discount applied
]);

const result = await toArray(
  pipe(
    cartActions,
    withLatestFrom(currentPrices, discountState),
    map(([action, prices, discount]) => {
      const basePrice = prices[action.productId] || 0;
      const finalPrice = discount.active 
        ? basePrice * (1 - discount.percentage / 100)
        : basePrice;
      
      return {
        action: action.action,
        product: action.productId,
        quantity: action.quantity,
        pricePerUnit: finalPrice,
        totalPrice: finalPrice * action.quantity,
        discountApplied: discount.active
      };
    })
  )
);
// Cart actions with current pricing and discounts
```

### Network Requests with Connection State

```typescript
const networkRequests = from([
  { url: '/api/data1', priority: 'high' },
  { url: '/api/data2', priority: 'low' },
  { url: '/api/data3', priority: 'medium' }
]);

const connectionState = from([
  { type: 'wifi', speed: 'fast', stable: true },
  { type: 'cellular', speed: 'slow', stable: false },
  { type: 'wifi', speed: 'fast', stable: true }
]);

const result = await toArray(
  pipe(
    networkRequests,
    withLatestFrom(connectionState),
    map(([request, connection]) => ({
      url: request.url,
      method: 'GET',
      timeout: connection.speed === 'slow' ? 10000 : 5000,
      retries: connection.stable ? 1 : 3,
      priority: request.priority,
      connectionType: connection.type
    }))
  )
);
// Network requests adapted to current connection quality
```

### Chat Messages with User Context

```typescript
const chatMessages = from([
  { message: 'Hello everyone!', timestamp: Date.now() },
  { message: 'How is everyone doing?', timestamp: Date.now() + 1000 },
  { message: 'Great! Thanks for asking.', timestamp: Date.now() + 2000 }
]);

const currentUser = from([
  { id: 'user1', name: 'Alice', status: 'online' },
  { id: 'user2', name: 'Bob', status: 'away' }
]);

const chatSettings = from([
  { notifications: true, theme: 'light', fontSize: 14 },
  { notifications: false, theme: 'dark', fontSize: 16 }
]);

const result = await toArray(
  pipe(
    chatMessages,
    withLatestFrom(currentUser, chatSettings),
    map(([msg, user, settings]) => ({
      message: msg.message,
      sender: user.name,
      senderId: user.id,
      timestamp: msg.timestamp,
      shouldNotify: settings.notifications && user.status === 'online',
      displayStyle: {
        theme: settings.theme,
        fontSize: settings.fontSize
      }
    }))
  )
);
// Chat messages with user and display context
```

### Data Processing with System Status

```typescript
const dataChunks = from([
  { data: 'chunk1', size: 1024 },
  { data: 'chunk2', size: 2048 },
  { data: 'chunk3', size: 512 }
]);

const systemStatus = from([
  { cpu: 45, memory: 60, load: 'normal' },
  { cpu: 80, memory: 85, load: 'high' },
  { cpu: 30, memory: 40, load: 'low' }
]);

const result = await toArray(
  pipe(
    dataChunks,
    withLatestFrom(systemStatus),
    map(([chunk, system]) => ({
      data: chunk.data,
      size: chunk.size,
      processingMode: system.load === 'high' ? 'batch' : 'realtime',
      priority: system.load === 'high' ? 'low' : 'normal',
      systemLoad: system.load,
      shouldCache: system.memory > 80
    }))
  )
);
// Data processing adapted to current system performance
```

### Timing-dependent Operations

```typescript
const userActions = timer(0, 1000).pipe( // Every second
  map(i => ({ action: `action-${i}`, timestamp: Date.now() })),
  take(5)
);

const timeBasedState = timer(500, 2000).pipe( // Every 2 seconds, starting at 500ms
  map(i => ({ 
    mode: i % 2 === 0 ? 'active' : 'passive',
    cycle: i,
    timestamp: Date.now()
  })),
  take(3)
);

const result = await toArray(
  pipe(
    userActions,
    withLatestFrom(timeBasedState),
    map(([action, state]) => ({
      action: action.action,
      actionTime: action.timestamp,
      currentMode: state.mode,
      cycle: state.cycle,
      modeAge: action.timestamp - state.timestamp
    }))
  )
);
// Actions combined with time-based state changes
```

### Waiting for All Streams

```typescript
// withLatestFrom waits for all other streams to emit at least once
const immediateActions = from(['action1', 'action2', 'action3']);

const slowState = timer(2000).pipe( // Emits after 2 seconds
  map(() => ({ ready: true, initialized: Date.now() }))
);

const result = await toArray(
  pipe(
    immediateActions,
    withLatestFrom(slowState),
    map(([action, state]) => ({
      action,
      state: state.ready ? 'ready' : 'waiting',
      initTime: state.initialized
    }))
  )
);
// No emissions until slowState emits its first value
// Then all immediate actions are processed with the state
```

### Error Handling

```typescript
const actions = from(['action1', 'action2', 'action3']);

const errorState = new ReadableStream({
  start(controller) {
    controller.enqueue({ status: 'ok' });
    setTimeout(() => controller.error(new Error('State error')), 1000);
  }
});

const result = await toArray(
  pipe(
    actions,
    withLatestFrom(errorState),
    map(([action, state]) => ({ action, state: state.status })),
    catchError(err => from([{ error: 'State stream failed' }]))
  )
);
// Error in other stream affects the combined stream
```

### Memory Efficiency

```typescript
// withLatestFrom only keeps the latest value from each other stream
const largeDataStream = interval(100).pipe(
  map(i => new Array(1000).fill(`data-${i}`)), // Large arrays
  take(10)
);

const triggerStream = timer(500, 200).pipe( // Trigger every 200ms starting at 500ms
  map(i => `trigger-${i}`),
  take(3)
);

const result = await toArray(
  pipe(
    triggerStream,
    withLatestFrom(largeDataStream),
    map(([trigger, data]) => ({
      trigger,
      dataSize: data.length,
      dataPreview: data.slice(0, 3) // Only use part of large data
    }))
  )
);
// Only the latest large data array is kept in memory
```

## Key Characteristics

- **Source-driven**: Only emits when the source stream emits
- **Latest values**: Always uses the most recent value from other streams
- **Waiting behavior**: Waits for all other streams to emit before any output
- **Memory efficient**: Only stores the latest value from each other stream
- **Type-safe**: Provides proper TypeScript types for tuple results

## Common Use Cases

- **Event handling with context**: Combine user actions with application state
- **Form processing**: Combine form submissions with validation and user preferences
- **Game mechanics**: Combine player actions with game state and world conditions
- **API requests**: Add authentication, configuration, or connection state to requests
- **Data processing**: Apply current calibration, pricing, or system status to data
- **Real-time monitoring**: Combine sensor readings with calibration or threshold data
- **UI interactions**: Combine user interactions with current UI state or preferences

## See Also

- [`combineLatest`](../combination.md#combineLatest) - Emit when any stream emits
- [`zip`](../combination.md#zip) - Wait for all streams to emit new values
- [`merge`](../combination.md#merge) - Combine streams concurrently
- [`startWith`](./startWith.md) - Prepend values to stream