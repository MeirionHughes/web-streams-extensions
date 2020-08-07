# WebStream Extensions

A collection of helper methods for WebStreams. 

requires support for ReadableStream [use a polyfill if they're not available](https://www.npmjs.com/package/web-streams-polyfill)

requires support for async / await

## Creation

### from<T>(src: Iterable<T> | AsyncIterable<T> | (()=>Iterable<T> | AsyncIterable<T>)): ReadableStream<T>

turns an interable source into a readable stream. 

It wiill not try create an iterator until the result stream is read from. 

```ts
from([1,2,3,4])
from(function*(){yield 1, yield 2, yield 3, yield 4};
from(async function*(){yield 1, yield 2, yield 3, await Promise.resolve(4)};
```

### concat<T>(...streams: ReadableStream<T>[]): ReadableStream<T>
concatinates several streams together in the order given.

It will not read from the streams until the result stream is read from. 

```ts
let inputA = [1,2];
let inputB = [1,2];
let expected = [1,2,3,4];
let stream = concat(from(inputA), from(inputB));
let result = await toArray(stream);
```

## Consuming

### toArray

```ts
let input = [1,2,3,4];
let expected = [1,2,3,4];
let result = await toArray(from([1,2,3,4]))
```

### toPromise
await exhaustion of the stream and return the last entry

```ts
let input = [1,2,3,4];
let expected = 4;
let result = await toPromise(from([1,2,3,4]));
```

## Piping

given inconsistencies with browser support, there is a pipe method available and all operators only require ReadableStream to be implemented, rather than use the native TransformStream. 
an error in any operator will error and close the whole pipeline

### pipe(src, ...ops): result

```ts
let input = [1, 2, 3, 4];
let expected = { "1": 1, "2": 2, "4": 4 };

let result = await toPromise(
  pipe(
    from(input),
    filter(x => x != 3),
    buffer(Infinity),
    map(x => {
      return x.reduce((p, c) => { p[c.toString()] = c; return p }, {});
    }),
    first()
  ));
```

## Operators

operators are of the form `type Op<T, R> = (src:ReadableStream<T>)=>ReadableStream<R>`


### buffer<T>(count: number, highWaterMark): Op<T, T[]>

buffer chunks until the buffer size is `count` length, then enqueues the buffer array and starts a new buffer

```ts
let input = [1,2,3,4];
let expected = [[1,2],[3,4]];
let stream = buffer(2)(from(input));
let result = await toArray(stream);
```

### filter<T>(predicate: (chunk: T) => boolean): Op<T, T>

filter out chunks that fail a predicate

```ts
let input = [1,2,3,4];
let expected = [1,2,4];
let stream = filter(x=>x!=3)(from(input));
let result = await toArray(stream);
```

### first<T>(selector:(chunk:T)=>boolean=()=>true): Op<T, T>

returns a stream of exactly one chunk, the first to return true when passed to the selector

```ts
let input = [1,2,3,4];
let expected = 3;
let stream = first(x=>x>=3)(from(input));
let result = await toPromise(stream);
```

### last<T>(selector:(chunk:T)=>boolean=()=>true): Op<T, T>

returns a stream of exactly one chunk, the last to return true when passed to the selector

```ts
let input = [1,2,3,4];
let expected = 3;
let stream = last(x=>x<4)(from(input));
let result = await toPromise(stream);
```

### map<T, R=T>(select:MapSelector<T, R>, highWaterMark): Op<T, R>

given a stream of T and selector f(T)->R, return a stream of R, for all f(T) != undefined

```ts
let input = [1,2,3,4];
let expected = [2,4,6,8];
let stream = map(x=>x*2)(from(input));
let result = await toArray(stream);
```

### tap<T>(cb: (chunk: T) => void): Op<T, T>

allows observing each chunk, but the output is exactly the same as in the input. 

```ts
let input = [1,2,3,4];
let expected = [1,2,3,4];
let result = []
let stream = tap(x=>result.push(x))(from(input));
let result = await toPromise(stream); //execute
```





