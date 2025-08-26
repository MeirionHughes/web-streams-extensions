
## Piping

To aid in pipelining operators, a `pipe` and `retryPipe` method is available: 

### pipe\<T>(src: ReadableStream\<T>, ...ops: Op[], options?: { highWaterMark?: number }): ReadableStream

Pipes a source stream through a series of operators, creating a transformation pipeline. Each operator transforms the stream in some way. The optional `highWaterMark` parameter controls buffering (defaults to 1).

```ts
let result = await toArray(
  pipe(
    from([1, 2, 3, 4]),
    filter(x => x != 3),
    map(x => x * 2),
    { highWaterMark: 8 }
  )
);
// Result: [2, 4, 8]
```

⚠️ReadableStreams are not recoverable like Observables are. If you start and consume a stream, that instance cannot be reused.  

### retryPipe\<T>(streamFactory: () => ReadableStream\<T>, ...operators: Op[], options?: RetryPipeOptions): ReadableStream\<T>

Creates a retry pipe that can recreate the entire stream pipeline on error. Unlike regular streams, this allows for retry semantics by recreating the source stream and reapplying all operators.

```ts
const result = retryPipe(
  () => fetchDataStream(), // Function that creates a new stream
  map(x => x * 2),
  filter(x => x > 10),
  { retries: 3, delay: 1000, highWaterMark: 8 }
);
```
⚠️ All operators within this library generally follow the pattern: 

```ts
function opmaker(args){
  // arg parsing
  return function op(in: ReadableStream){ 
    // state...
    return out /* ReadableStream */
  }
}
```
i.e. they do not cache or store values within the opmaker scope. This means that they are compatible with the retryPipe, where it will regenerate and repipe the op function pipeline on each retry. If you use custom operators, ensure they follow the same rule. 


### toTransform(operatorFactory): TransformStream

Sometimes you want to use existing operators as native Web Streams TransformStreams (for example to use with `pipeThrough`). The `toTransform` helper converts any unary operator factory into a constructable `TransformStream` class. This allows you to do:

```ts
import { toTransform } from 'web-streams-extensions';
import { map } from 'web-streams-extensions/operators';

const MapTransform = toTransform(map);

...

source.pipeThrough(new MapTransform((x: number) => x * 2));
```

For convenience, all operators are re-exported as TransformStream constructors from `web-streams-extensions/transformers`. For example:

```ts
import { MapTransform } from 'web-streams-extensions/transformers';

someStream
  .pipeThrough(new MapTransform((x: number) => x * 2))
  .pipeTo(...
```

️⚠️`web-streams-extensions/transformers` may not be tree-shakeable unless your bundler understands `/* @__PURE__ */`