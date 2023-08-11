# WebStream Extensions

A collection of helper methods for WebStreams, inspired by ReactiveExtensions. 
Being built on-top of ReadableStream we can have a reactive-pipeline with non-blocking back-pressure built-in. 

requires support for ReadableStream [use a polyfill if they're not available](https://www.npmjs.com/package/web-streams-polyfill)

Subjects require support for WritableStream. Requires support for async / await.

## Creation

### from<T>(src: Iterable<T> | AsyncIterable<T> | (()=>Iterable<T> | AsyncIterable<T>) | ReadableLike<T>): ReadableStream<T>

turns an iterable source into a readable stream. 

It will not try create an iterator until the result stream is read from. 

```ts
from([1,2,3,4])
from(function*(){yield 1, yield 2, yield 3, yield 4};
from(async function*(){yield 1, yield 2, yield 3, await Promise.resolve(4)};
```

### of<T>(...args:T[]): ReadableStream<T>
creates a ReadableStream where the chunks will be the in-order arguments passed to it

```ts
of(1, "foo", ()=>"bar", {})
```
### concat<T>(...streams: ReadableStream<T>[]): ReadableStream<T>
concatenates several streams together in the order given.

It will not read from the streams until the result stream is read from. 

```ts
let inputA = [1,2];
let inputB = [3,4];
let expected = [1,2,3,4];
let stream = concat(from(inputA), from(inputB));
let result = await toArray(stream);
```

### defer<T>(cb: ()=>Promise<ReadableStream<T>> | ReadableStream<T>): ReadableStream<T>
await a callback method that returns a readable-stream

```ts
let input = [1,2,3,4];
let expected = [1,2,3,4];

let result = await toArray(defer(x=>Promise.resolve(from(input))));
```



## Consuming

### toArray(src: ReadableStream<T>): T[]

```ts
let input = [1,2,3,4];
let expected = [1,2,3,4];
let result = await toArray(from([1,2,3,4]))
```

### toPromise(src: ReadableStream<T>): T
await exhaustion of the stream and return the last entry

```ts
let input = [1,2,3,4];
let expected = 4;
let result = await toPromise(from([1,2,3,4]));
```

### subscribe(src, next, complete, error): ()=>void

immediately begins to read from src, passing each chunk to the `next` callback and awaiting if it returns a promise. 
once the source signals the end of the stream, `complete` is called. 
if the source stream throws an error, this is passed to the `error` callback
returns a disposer method to stop reading

```ts 
let src = from(function*(){yield 1, yield 2, yield 3})

subscribe(src, 
  (next)=>{ console.log("Next:", next);})
  ()=>{console.log("Complete")}
  (err)=>{console.log("Error:", err)}
);
```

## Piping

Given inconsistencies in browser support for anything other than ReadableStream, we opted to make an Operator a function of the form:

`type Op<T, R> = (src:ReadableStream<T>)=>ReadableStream<R>`

this only requires ReadableStream to be implemented/available with getReader support. To aid pipeline these operators, a `pipe` method is available: 

### pipe(src: ReadableStream, ...ops:Op): ReadableStream

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

### buffer<T>(count: number, highWaterMark: number): Op<T, T[]>

buffer chunks until the buffer size is `count` length, then enqueues the buffer and starts a new buffer

```ts
let input = [1,2,3,4];
let expected = [[1,2],[3,4]];
let stream = buffer(2)(from(input));
let result = await toArray(stream);
```

### concatAll<T>(): Op<ReadableStream<T>, T>
given a ReadableStream of ReadableStreams, concatenates the output of each stream. 


```ts
let input = [from([1,2]), from([3,4]), from([5])];
let expected = [1,2,3,4,5];
let stream = concatAll()(from(input));
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

### first<T>(predicate?:(chunk:T)=>boolean): Op<T, T>

returns a stream of one chunk, the first to return true when passed to the selector, or simply the first if no predicate is supplied

```ts
let input = [1,2,3,4];
let expected = 3;
let stream = first(x=>x>=3)(from(input));
let result = await toPromise(stream);
```

### last<T>(predicate?:(chunk:T)=>boolean): Op<T, T>

returns a stream of one chunk, the last to return true when passed to the predicate, or simply the last if no predicate is supplied.

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

### skip<T>(count: number): Op<T, T>

skip `count` elements and then stream the rest to the output

```ts
let input = [1,2,3,4,5];
let expected = [3,4,5];
let stream = pipe(from(input), skip(2));
let result = await toArray(stream); 
```

### take<T>(count: number): Op<T, T>

take `count` elements and close

```ts
let input = [1,2,3,4,5];
let expected = [1,2];
let stream = pipe(from(input), take(2));
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

### timeout<T>(duration: number): Op<T, T>

throws an error if the duration between chunks exceeds the duration (milliseconds)


## Subjects

Subjects are duplex streams with automatic tee'ing of the readable. i.e. each access call to `subject.readable` returns a _new_ ReadableStream<T>. 

### Subject<T>()

> proof of concept - its likely there are cases not covered by the tests. 

a Subject instance has the following members:

```ts
  readable: ReadableStream<T>;  
  writable: WritableStream<T>;

  next(value:T): number;
  complete(): void;
  error(err): void;
```

you can `pipeTo` the subject's `writable`:


```ts
let input = [1, 2, 3, 4];
let subject = new Subject<number>();

let resultPromise = toArray(subject.readable);

from(input).pipeTo(subject.writable);

let result = await resultPromise;//[1,2,3,4]
```

or `pipeThrough` the subject: 

```ts
let input = [1, 2, 3, 4];
let subject = new Subject<number>();

let result = await toArray(from(input).pipeThrough(subject));

expect(result).to.be.deep.eq(expected); // [1,2,3,4]
```

or manually call `next`, `complete`, `error`

```ts
let subject = new Subject<number>();
let resultPromise = toArray(subject.readable);

subject.next(1);
subject.next(2);
subject.next(3);
subject.next(4);
subject.complete();

let result = await resultPromise; // [1,2,3,4]
```

although mixing these approaches is not advised - unpredictable behavior. 





