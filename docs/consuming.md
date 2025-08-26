## Consuming

### toArray\<T>(src: ReadableStream\<T>): Promise\<T[]>

Consumes a ReadableStream and returns all values as an array. The stream will be read to completion.

```ts
let result = await toArray(from([1, 2, 3, 4]));
// Result: [1, 2, 3, 4]
```

### toPromise\<T>(src: ReadableStream\<T>): Promise\<T>

Consumes a ReadableStream and returns the last value emitted. The stream will be read to completion.

```ts
let result = await toPromise(from([1, 2, 3, 4]));
// Result: 4
```

### toString\<T>(src: ReadableStream\<T>, selector?: (value: T) => string): Promise\<string>

Consumes a ReadableStream and combines all chunks into a single string using an optional selector function.

```ts
let result = await toString(from(['hello', ' ', 'world']));
// Result: "hello world"

let result2 = await toString(from([1, 2, 3]), x => x.toString() + ',');
// Result: "1,2,3,"
```

### subscribe\<T>(src, next, complete?, error?): SubscriptionLike

Immediately begins to read from src, passing each chunk to the `next` callback and awaiting if it returns a promise. 
Once the source signals the end of the stream, `complete` is called. 
If the source stream throws an error, this is passed to the `error` callback.
Returns a subscription object with an `unsubscribe` method to stop reading.

```ts 
let src = from(function*() { yield 1; yield 2; yield 3; });

subscribe(src, 
  (next) => { console.log("Next:", next); },
  () => { console.log("Complete"); },
  (err) => { console.log("Error:", err); }
);
```