# Operators 

Operators are functions of the form: 
`type Op<T, R> = (src: ReadableStream<T>) => ReadableStream<R>`
This only requires ReadableStream to be implemented/available with getReader support. 

## Operator Categories

### Transformation Operators
Transform each value or the entire stream structure:
- [`map`](./operators/map.md) - Transform each value through a function
- [`mapSync`](./operators/mapSync.md) - Synchronous transformation for better performance  
- [`scan`](./operators/scan.md) - Accumulate values and emit intermediate results
- [`reduce`](./operators/reduce.md) - Accumulate values and emit only the final result
- [`switchMap`](./operators/switchMap.md) - Map to streams, switch to latest (with cancellation)
- [`concatMap`](./operators/concatMap.md) - Map to streams, concatenate sequentially
- [`mergeMap`](./operators/mergeMap.md) - Map to streams, merge concurrently
- [`exhaustMap`](./operators/exhaustMap.md) - Map to streams, ignore new while active
- [`switchAll`](./operators/switchAll.md) - Flatten stream of streams, switch to latest
- [`concatAll`](./operators/concatAll.md) - Flatten stream of streams sequentially  
- [`mergeAll`](./operators/mergeAll.md) - Flatten stream of streams concurrently
- [`exhaustAll`](./operators/exhaustAll.md) - Flatten stream of streams, ignore new while active
- [`pairwise`](./operators/pairwise.md) - Emit previous and current values as pairs

### Filtering Operators
Filter or limit the values that pass through:
- [`filter`](./operators/filter.md) - Filter values with a predicate
- [`distinctUntilChanged`](./operators/distinctUntilChanged.md) - Remove consecutive duplicates
- [`distinctUntilKeyChanged`](./operators/distinctUntilKeyChanged.md) - Remove consecutive duplicates by key
- [`distinct`](./operators/distinct.md) - Remove duplicate values globally
- [`first`](./operators/first.md) - Take first value (optionally matching predicate)
- [`last`](./operators/last.md) - Take last value (optionally matching predicate)
- [`take`](./operators/take.md) - Take first N values
- [`takeUntil`](./operators/takeUntil.md) - Take until another stream emits
- [`takeWhile`](./operators/takeWhile.md) - Take while predicate is true
- [`skip`](./operators/skip.md) - Skip first N values
- [`skipWhile`](./operators/skipWhile.md) - Skip while predicate is true
- [`ignoreElements`](./operators/ignoreElements.md) - Ignore all values, preserve completion

### Timing Operators
Control the timing of emissions:
- [`debounceTime`](./operators/debounceTime.md) - Emit latest value after quiet period
- [`throttleTime`](./operators/throttleTime.md) - Limit emission rate
- [`delay`](./operators/delay.md) - Delay all emissions by specified time
- [`timeout`](./operators/timeout.md) - Error if no emission within duration

### Buffering Operators
Collect and group values:
- [`buffer`](./operators/buffer.md) - Buffer into arrays of specified size
- [`startWith`](./operators/startWith.md) - Prepend values to stream

### Utility Operators
Observe, handle errors, and control flow:
- [`tap`](./operators/tap.md) - Observe values without modification
- [`on`](./operators/on.md) - Attach lifecycle callbacks
- [`catchError`](./operators/catchError.md) - Handle errors with fallback stream
- [`schedule`](./operators/schedule.md) - Control emission timing with scheduler
- [`through`](./operators/through.md) - Use native TransformStream
- [`withLatestFrom`](./operators/withLatestFrom.md) - Combine with latest from other stream
- [`defaultIfEmpty`](./operators/defaultIfEmpty.md) - Provide default for empty streams
- [`count`](./operators/count.md) - Count values (optionally with predicate)
- [`bridge`](./operators/bridge.md) - Bridge to external stream systems
