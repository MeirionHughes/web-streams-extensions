# debounceTime

Emits a notification from the source stream only after a particular time span has passed without another source emission. This operator delays values emitted by the source stream, but drops previous pending delayed emissions if a new value arrives on the source stream.

## Type Signature

```typescript
function debounceTime<T>(
  duration: number
): (src: ReadableStream<T>, strategy?: QueuingStrategy<T>) => ReadableStream<T>
```

## Parameters

- `duration`: Duration in milliseconds to wait for silence before emitting the most recent value. Must be positive.

## Examples

### Basic Debouncing

```typescript
// Simulating rapid user input
const rapidInput = from(['a', 'ab', 'abc', 'abcd']);

const result = await toArray(
  pipe(
    rapidInput,
    debounceTime(300)
  )
);
// Input:  a-ab-abc-abcd--------|
// Output: -------------------abcd|
// Result: ['abcd'] (only the last value after 300ms of silence)
```

### Search Input Debouncing

```typescript
const searchQueries = from(['j', 'ja', 'jav', 'java', 'javascript']);

const result = await toArray(
  pipe(
    searchQueries,
    debounceTime(500) // Wait 500ms after user stops typing
  )
);
// Input:  j-ja-jav-java-javascript---------|
// Output: --------------------------javascript|
// Result: ['javascript']
```

### Button Click Debouncing

```typescript
// Simulate multiple rapid button clicks
const clicks = timer(0, 50); // Click every 50ms
const debouncedClicks = pipe(
  clicks,
  take(5), // 5 rapid clicks
  debounceTime(200) // Only register after 200ms of no clicks
);

const result = await toArray(debouncedClicks);
// Input:  0--1--2--3--4------------|
// Output: ------------------4------|
// Result: [4] (only the last click after silence)
```

### API Request Debouncing

```typescript
const userInput = from(['h', 'he', 'hel', 'hello']);

const debouncedRequests = pipe(
  userInput,
  debounceTime(300),
  map(query => `API call for: ${query}`)
);

const result = await toArray(debouncedRequests);
// Input:  h-he-hel-hello-----------|
// Debounced: ---------------hello-|
// Output: ---------------"API call for: hello"|
// Result: ['API call for: hello']
```

### Multiple Bursts

```typescript
// Simulate typing in bursts with pauses
const burstInput = from([
  'a', 'ab', 'abc',    // First burst
  // 500ms pause
  'x', 'xy', 'xyz'     // Second burst
]);

// This would need actual timing to demonstrate properly
// But conceptually:
// Input:  a-ab-abc-----x-xy-xyz-----|
// Output: --------abc--------xyz---|
// Result: ['abc', 'xyz']
```

### Real-world Form Validation

```typescript
const emailInput = from([
  'u',
  'us',
  'use',
  'user',
  'user@',
  'user@ex',
  'user@example',
  'user@example.',
  'user@example.com'
]);

const validatedEmail = pipe(
  emailInput,
  debounceTime(300), // Wait for user to stop typing
  filter(email => email.includes('@') && email.includes('.'))
);

const result = await toArray(validatedEmail);
// Input:  u-us-use-user-user@-user@ex-user@example-user@example.-user@example.com--|
// Debounced: ----------------------------------------------------------user@example.com|
// Filtered: ----------------------------------------------------------user@example.com|
// Result: ['user@example.com']
```

### Network Request Cancellation

```typescript
const searchTerms = from(['react', 'reactive', 'rxjs']);

const debouncedSearch = pipe(
  searchTerms,
  debounceTime(300),
  map(term => fetch(`/search?q=${term}`))
);

// Only the final search term triggers a network request
// Previous requests are effectively cancelled by debouncing
```

## Behavior Notes

- **Only latest value**: Only the most recent value is emitted after the silence period
- **Silence detection**: Timer resets on every new emission
- **Final emission**: The last value is emitted when the source stream completes
- **Error handling**: Errors are propagated immediately without debouncing

## Common Use Cases

- **User input**: Search boxes, form validation
- **Button clicks**: Preventing double-clicks
- **API calls**: Reducing request frequency
- **Resize events**: Window or element resize handling
- **Scroll events**: Performance optimization for scroll handlers

## See Also

- [`throttleTime`](./throttleTime.md) - Limit emission rate (different timing behavior)
- [`delay`](./delay.md) - Delay all emissions by a fixed amount
- [`distinctUntilChanged`](./distinctUntilChanged.md) - Remove consecutive duplicates