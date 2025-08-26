# distinct

Filters out duplicate values from the stream based on strict equality or a custom key selector function. Maintains a record of all previously seen values to ensure uniqueness throughout the entire stream.

## Type Signature

```typescript
function distinct<T, K = T>(
  keySelector?: (value: T) => K
): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T>
```

## Parameters

- `keySelector` *(optional)*: Function to extract a comparison key from each value. If omitted, values are compared directly using strict equality.

## Examples

### Basic Distinct with Primitives

```typescript
const result = await toArray(
  pipe(
    from([1, 2, 2, 3, 1, 4, 3, 2]),
    distinct()
  )
);
// Input:  1---2---2---3---1---4---3---2---|
// Output: 1---2-------3-------4-----------|
// Result: [1, 2, 3, 4] (duplicates removed)
```

### Distinct Strings

```typescript
const result = await toArray(
  pipe(
    from(['apple', 'banana', 'apple', 'cherry', 'banana', 'date']),
    distinct()
  )
);
// Input:  'apple'---'banana'---'apple'---'cherry'---'banana'---'date'---|
// Output: 'apple'---'banana'----------'cherry'----------'date'---|
// Result: ['apple', 'banana', 'cherry', 'date']
```

### Distinct with Key Selector

```typescript
const users = from([
  { id: 1, name: 'John', email: 'john@example.com' },
  { id: 2, name: 'Jane', email: 'jane@example.com' },
  { id: 1, name: 'John Doe', email: 'john.doe@example.com' }, // Same id
  { id: 3, name: 'Bob', email: 'bob@example.com' },
  { id: 2, name: 'Jane Smith', email: 'jane.smith@example.com' } // Same id
]);

const result = await toArray(
  pipe(
    users,
    distinct(user => user.id) // Distinct by user ID
  )
);
// Result: [
//   { id: 1, name: 'John', email: 'john@example.com' },
//   { id: 2, name: 'Jane', email: 'jane@example.com' },
//   { id: 3, name: 'Bob', email: 'bob@example.com' }
// ] (later users with same ID are filtered out)
```

### Distinct by Email

```typescript
const contacts = from([
  { name: 'Alice', email: 'alice@example.com', department: 'Engineering' },
  { name: 'Bob', email: 'bob@example.com', department: 'Marketing' },
  { name: 'Alice Johnson', email: 'alice@example.com', department: 'Sales' },
  { name: 'Charlie', email: 'charlie@example.com', department: 'Engineering' }
]);

const result = await toArray(
  pipe(
    contacts,
    distinct(contact => contact.email)
  )
);
// Removes duplicate emails, keeping first occurrence
// Result: Alice (Engineering), Bob, Charlie
```

### Distinct Product Categories

```typescript
const products = from([
  { name: 'iPhone', category: 'Electronics', price: 999 },
  { name: 'MacBook', category: 'Electronics', price: 1299 },
  { name: 'T-Shirt', category: 'Clothing', price: 25 },
  { name: 'iPad', category: 'Electronics', price: 599 },
  { name: 'Jeans', category: 'Clothing', price: 79 }
]);

const uniqueCategories = await toArray(
  pipe(
    products,
    distinct(product => product.category),
    map(product => product.category)
  )
);
// Result: ['Electronics', 'Clothing'] (unique categories)
```

### Distinct User Actions by Type

```typescript
const userEvents = from([
  { type: 'click', target: 'button1', timestamp: 100 },
  { type: 'scroll', position: 200, timestamp: 150 },
  { type: 'click', target: 'button2', timestamp: 200 },
  { type: 'hover', target: 'menu', timestamp: 250 },
  { type: 'scroll', position: 400, timestamp: 300 },
  { type: 'keypress', key: 'Enter', timestamp: 350 }
]);

const uniqueEventTypes = await toArray(
  pipe(
    userEvents,
    distinct(event => event.type)
  )
);
// Result: First occurrence of each event type
// ['click', 'scroll', 'hover', 'keypress']
```

### Distinct API Endpoints

```typescript
const apiCalls = from([
  { method: 'GET', endpoint: '/users', timestamp: 100 },
  { method: 'POST', endpoint: '/posts', timestamp: 150 },
  { method: 'GET', endpoint: '/users', timestamp: 200 }, // Duplicate
  { method: 'PUT', endpoint: '/users/1', timestamp: 250 },
  { method: 'GET', endpoint: '/posts', timestamp: 300 },
  { method: 'POST', endpoint: '/posts', timestamp: 350 } // Duplicate
]);

const uniqueEndpoints = await toArray(
  pipe(
    apiCalls,
    distinct(call => `${call.method} ${call.endpoint}`)
  )
);
// Distinct by method + endpoint combination
```

### Distinct Complex Keys

```typescript
const orders = from([
  { customerId: 'C1', productId: 'P1', quantity: 2 },
  { customerId: 'C2', productId: 'P2', quantity: 1 },
  { customerId: 'C1', productId: 'P1', quantity: 3 }, // Same customer + product
  { customerId: 'C1', productId: 'P2', quantity: 1 },
  { customerId: 'C2', productId: 'P1', quantity: 2 }
]);

const uniqueCustomerProducts = await toArray(
  pipe(
    orders,
    distinct(order => `${order.customerId}-${order.productId}`)
  )
);
// Distinct by customer-product combination
```

### Distinct Log Entries by Error Code

```typescript
const logEntries = from([
  { level: 'error', code: 'AUTH_FAILED', message: 'Authentication failed' },
  { level: 'info', code: 'USER_LOGIN', message: 'User logged in' },
  { level: 'error', code: 'AUTH_FAILED', message: 'Invalid credentials' },
  { level: 'warn', code: 'RATE_LIMIT', message: 'Rate limit exceeded' },
  { level: 'error', code: 'DB_CONNECTION', message: 'Database connection lost' },
  { level: 'error', code: 'AUTH_FAILED', message: 'Token expired' }
]);

const uniqueErrorTypes = await toArray(
  pipe(
    logEntries,
    filter(entry => entry.level === 'error'),
    distinct(entry => entry.code)
  )
);
// Result: First occurrence of each error type
```

### Distinct Sensor Readings by Location

```typescript
const sensorData = from([
  { location: 'Room A', temperature: 22.5, timestamp: 100 },
  { location: 'Room B', temperature: 24.1, timestamp: 150 },
  { location: 'Room A', temperature: 23.0, timestamp: 200 }, // Same location
  { location: 'Room C', temperature: 21.8, timestamp: 250 },
  { location: 'Room B', temperature: 24.5, timestamp: 300 }  // Same location
]);

const uniqueLocations = await toArray(
  pipe(
    sensorData,
    distinct(reading => reading.location)
  )
);
// Result: First reading from each location
```

### Distinct File Extensions

```typescript
const files = from([
  'document.pdf',
  'image1.jpg',
  'script.js',
  'photo.png',
  'data.json',
  'image2.jpg', // Same extension as image1.jpg
  'config.ini',
  'backup.pdf'  // Same extension as document.pdf
]);

const uniqueExtensions = await toArray(
  pipe(
    files,
    distinct(filename => filename.split('.').pop()),
    map(filename => filename.split('.').pop())
  )
);
// Result: ['pdf', 'jpg', 'js', 'png', 'json', 'ini'] (unique extensions)
```

### Distinct Network Protocols

```typescript
const networkPackets = from([
  { protocol: 'HTTP', port: 80, size: 1024 },
  { protocol: 'HTTPS', port: 443, size: 1536 },
  { protocol: 'FTP', port: 21, size: 512 },
  { protocol: 'HTTP', port: 8080, size: 2048 }, // Same protocol, different port
  { protocol: 'SSH', port: 22, size: 256 },
  { protocol: 'HTTPS', port: 8443, size: 1024 } // Same protocol, different port
]);

const uniqueProtocols = await toArray(
  pipe(
    networkPackets,
    distinct(packet => packet.protocol)
  )
);
// Result: First packet of each protocol type
```

### Distinct Game Events by Player

```typescript
const gameEvents = from([
  { player: 'Alice', action: 'move', timestamp: 100 },
  { player: 'Bob', action: 'attack', timestamp: 150 },
  { player: 'Alice', action: 'jump', timestamp: 200 }, // Same player
  { player: 'Charlie', action: 'cast', timestamp: 250 },
  { player: 'Bob', action: 'defend', timestamp: 300 }  // Same player
]);

const firstPlayerActions = await toArray(
  pipe(
    gameEvents,
    distinct(event => event.player)
  )
);
// Result: First action by each player
```

### Distinct Shopping Cart Items

```typescript
const cartActions = from([
  { action: 'add', productId: 'P1', quantity: 1 },
  { action: 'add', productId: 'P2', quantity: 2 },
  { action: 'update', productId: 'P1', quantity: 3 }, // Same product
  { action: 'add', productId: 'P3', quantity: 1 },
  { action: 'remove', productId: 'P2', quantity: 0 }  // Same product
]);

const uniqueProducts = await toArray(
  pipe(
    cartActions,
    distinct(action => action.productId)
  )
);
// Result: First action for each product
```

### Distinct Configuration Settings

```typescript
const configUpdates = from([
  { setting: 'theme', value: 'dark', timestamp: 100 },
  { setting: 'language', value: 'en', timestamp: 150 },
  { setting: 'theme', value: 'light', timestamp: 200 }, // Same setting
  { setting: 'fontSize', value: '14px', timestamp: 250 },
  { setting: 'language', value: 'es', timestamp: 300 }  // Same setting
]);

const settingsFirstUpdate = await toArray(
  pipe(
    configUpdates,
    distinct(update => update.setting)
  )
);
// Result: First update for each setting type
```

### Distinct by Composite Key

```typescript
const salesData = from([
  { region: 'North', product: 'A', sales: 100 },
  { region: 'South', product: 'B', sales: 150 },
  { region: 'North', product: 'A', sales: 120 }, // Same region + product
  { region: 'East', product: 'A', sales: 80 },
  { region: 'South', product: 'B', sales: 200 }  // Same region + product
]);

const uniqueRegionProducts = await toArray(
  pipe(
    salesData,
    distinct(sale => JSON.stringify({ region: sale.region, product: sale.product }))
  )
);
// Result: First sales data for each region-product combination
```

### Distinct URLs

```typescript
const webRequests = from([
  { url: 'https://api.example.com/users', method: 'GET' },
  { url: 'https://api.example.com/posts', method: 'GET' },
  { url: 'https://api.example.com/users', method: 'POST' }, // Same URL, different method
  { url: 'https://cdn.example.com/images', method: 'GET' },
  { url: 'https://api.example.com/posts', method: 'PUT' }   // Same URL, different method
]);

const uniqueUrls = await toArray(
  pipe(
    webRequests,
    distinct(request => request.url)
  )
);
// Result: First request to each unique URL
```

### Performance Considerations

```typescript
// distinct() keeps all seen keys in memory
const largeDataset = range(1, 100000).pipe(
  map(i => ({ id: i % 1000, value: `item-${i}` })) // 1000 unique IDs repeated
);

const uniqueItems = await toArray(
  pipe(
    largeDataset,
    distinct(item => item.id), // Memory usage: ~1000 keys stored
    take(1000) // Take first 1000 unique items
  )
);
// Memory grows with number of unique keys, not total items
```

### Distinct with Object References

```typescript
const objectA = { name: 'Object A' };
const objectB = { name: 'Object B' };
const objectC = { name: 'Object A' }; // Same content, different reference

const objects = from([objectA, objectB, objectA, objectC, objectB]);

const uniqueObjects = await toArray(
  pipe(
    objects,
    distinct() // Uses object reference, not content
  )
);
// Result: [objectA, objectB, objectC] (objectC is considered different)

// To compare by content:
const uniqueByContent = await toArray(
  pipe(
    objects,
    distinct(obj => obj.name)
  )
);
// Result: [objectA, objectB] (objectC filtered out due to same name)
```

### Error Handling

```typescript
const dataWithErrors = from([
  { id: 1, name: 'Item 1' },
  { id: 2, name: 'Item 2' },
  { id: 3, name: 'Item 3' }
]);

const result = await toArray(
  pipe(
    dataWithErrors,
    distinct(item => {
      if (item.id === 2) throw new Error('Key extraction error');
      return item.id;
    }),
    catchError(err => from([{ id: -1, name: 'Error occurred' }]))
  )
);
// Error in key selector propagates through stream
```

### Testing Distinct Behavior

```typescript
// Test that order is preserved for unique items
const testData = from([3, 1, 4, 1, 5, 9, 2, 6, 5, 3]);

const uniqueItems = await toArray(
  pipe(
    testData,
    distinct()
  )
);
// Result: [3, 1, 4, 5, 9, 2, 6] (first occurrence order preserved)
```

### Memory Cleanup

```typescript
// When stream completes or is cancelled, memory is cleaned up
const longRunningStream = interval(100).pipe(
  map(i => ({ id: i % 10, value: i })),
  take(1000)
);

const uniqueStream = pipe(
  longRunningStream,
  distinct(item => item.id)
);

// Memory is automatically cleaned when stream completes
```

### Combining with Other Operators

```typescript
const events = from([
  { type: 'click', user: 'Alice', timestamp: 100 },
  { type: 'view', user: 'Bob', timestamp: 150 },
  { type: 'click', user: 'Alice', timestamp: 200 },
  { type: 'purchase', user: 'Charlie', timestamp: 250 },
  { type: 'view', user: 'Bob', timestamp: 300 }
]);

const uniqueUserActions = await toArray(
  pipe(
    events,
    filter(event => event.type === 'click'),
    distinct(event => event.user),
    map(event => ({ user: event.user, firstClick: event.timestamp }))
  )
);
// Result: First click timestamp for each user
```

## Key Characteristics

- **Global uniqueness**: Remembers all values seen throughout the stream's lifetime
- **Order preservation**: Maintains the order of first occurrences
- **Memory growth**: Memory usage grows with the number of unique keys
- **Key flexibility**: Supports custom key extraction for complex comparisons
- **Reference vs. content**: Default comparison uses strict equality (reference for objects)

## Common Use Cases

- **Deduplication**: Remove duplicate records from data streams
- **Unique identifiers**: Extract unique IDs, emails, or usernames
- **Event filtering**: Get unique event types or user actions
- **Data analysis**: Find unique categories, tags, or classifications
- **API optimization**: Avoid duplicate requests to same endpoints
- **User tracking**: Track unique users or sessions
- **Content management**: Handle unique content items or assets
- **Configuration management**: Track unique settings or preferences

## See Also

- [`distinctUntilChanged`](./distinctUntilChanged.md) - Only filter consecutive duplicates
- [`distinctUntilKeyChanged`](./distinctUntilKeyChanged.md) - Consecutive duplicates by key
- [`filter`](./filter.md) - General value filtering
- [`groupBy`](../utils.md#groupBy) - Group values by key