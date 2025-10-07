# web-streams-extensions: Copilot Instructions

## Architecture Overview

This is a **reactive programming library for WebStreams API**, inspired by ReactiveExtensions (RxJS). It provides operators, creation functions, and utilities for composing and transforming streams with built-in backpressure support.

### Core Components

1. **Creation Functions** (`src/*.ts`): Create streams from various sources
   - `from()`, `of()`, `timer()`, `interval()`, `range()`, `defer()`, `combineLatest()`, `zip()`, etc.

2. **Operators** (`src/operators/*.ts`): Transform and control streams (40+ operators)
   - `map()`, `filter()`, `mergeMap()`, `switchMap()`, `take()`, `debounceTime()`, etc.
   - Each operator returns `UnaryFunction<T, R>` that accepts `(source, strategy?) => ReadableStream<R>`

3. **Subjects** (`src/subjects/*.ts`): Multicast streams (both readable and writable)
   - `Subject`, `BehaviorSubject`, `ReplaySubject`
   - Implements both `ReadableStream` (via `.readable`) and `WritableStream` (via `.writable`)
   - Uses internal `Subscribable` class for managing multiple subscribers with backpressure

4. **Pipe** (`src/pipe.ts`): Chain operators together
   - Accepts `Op<T, R>` which can be either `UnaryFunction<T, R>` or `TransformStream<T, R>`
   - Last parameter can be `QueuingStrategy` for backpressure control

5. **Consumers**: Convert streams to other types
   - `toArray()`, `toPromise()`, `toString()`, `subscribe()`

### Critical Patterns

#### Backpressure via `desiredSize`
All operators check `controller.desiredSize` to implement backpressure:
```typescript
while (controller.desiredSize > 0 && reader != null) {
  let next = await reader.read();
  // ... process and enqueue
}
```

#### Operator Structure
Standard pattern for operators (see `src/operators/map.ts`):
```typescript
export function map<T, R>(selector: (chunk: T, index: number) => R | Promise<R>) {
  let reader: ReadableStreamDefaultReader<T> = null;
  return function (src: ReadableStream<T>, strategy: QueuingStrategy<R> = { highWaterMark: 16 }) {
    return new ReadableStream<R>({
      start(controller) { /* setup reader */ },
      pull(controller) { /* flush data */ },
      cancel(reason?) { /* cleanup reader */ }
    }, strategy);
  }
}
```

#### Internal Types Convention
Files prefixed with `_` are internal abstractions:
- `_op.ts`: `Op<T, R>`, `UnaryFunction<T, R>` types
- `_subscribable.ts`: Multi-subscriber management with backpressure
- `_readable-like.ts`: Objects with `.readable` property
- `_subject.ts`, `_scheduler.ts`, `_subscription.ts`: Core interfaces

#### Import Extensions
Use `.js` extensions in imports (TypeScript with `NodeNext` module resolution):
```typescript
import { map } from "./operators/map.js";
```

## Development Workflows

### Testing
- **Run all tests**: `npm test` (Node.js only, excludes worker tests)
- **Isolated test**: `npx mocha spec/path/to/file.spec.ts`
- **Coverage**: `npm run test:cover` (requires 85%+ statement coverage)
- **Browser tests**: `npm run test:browser` or `npm run test:browser:watch`
- **All tests (Node + Browser)**: `npm run test:all`

### Test Structure (Mocha + Chai)
Follow Arrange-Act-Assert pattern:
```typescript
it("should handle operator behavior", async () => {
  // Arrange
  let input = [1, 2, 3];
  
  // Act
  let result = await toArray(pipe(from(input), map(x => x * 2)));
  
  // Assert
  expect(result).to.deep.equal([2, 4, 6]);
});
```

### Bug Reports Requirement
All bug reports **MUST** include a failing test in `spec/failing.spec.ts` before being accepted. See `CONTRIBUTING.md`.

### Debugging
- Debug files: `.debug/{filename}.ts`
- Run with: `tsx ./.debug/{filename}.ts`

### Build System
- **ESM build**: `npm run build:esm` → `dist/esm/` with `.js` extensions
- **CJS build**: `npm run build:cjs` → `dist/cjs/` with `.cjs` extensions (post-processed by `scripts/convert-cjs-extensions.cjs`)
- **Both**: `npm run build` (runs both in parallel)
- **Workers**: `npm run build:workers` (separate build for worker files)

## Project-Specific Conventions

1. **Default Strategy**: Use `{ highWaterMark: 16 }` as default for all operators
2. **Cancellation**: Always handle cleanup in `cancel()` method with try-catch
3. **Error Handling**: Wrap cleanup in try-catch, gracefully ignore cleanup errors
4. **Reader Management**: Always `releaseLock()` in finally blocks
5. **Test Coverage**: Maintain 85%+ coverage for all source files
6. **Type Safety**: Leverage TypeScript's strict mode with proper generics
  