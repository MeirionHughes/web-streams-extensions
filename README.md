# WebStream Extensions

[![npm version](https://img.shields.io/npm/v/web-streams-extensions.svg)](https://www.npmjs.com/package/web-streams-extensions)
[![Build Status](https://github.com/MeirionHughes/web-streams-extensions/workflows/Tests/badge.svg)](https://github.com/MeirionHughes/web-streams-extensions/actions)
[![codecov](https://codecov.io/gh/MeirionHughes/web-streams-extensions/branch/master/graph/badge.svg)](https://codecov.io/gh/MeirionHughes/web-streams-extensions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)


A collection helper methods for WebStreams, inspired by ReactiveExtensions. 

## Installation

```bash
npm install web-streams-extensions
```

## Basic Usage

```typescript
import { from, pipe, map, filter, toArray } from 'web-streams-extensions';

// Create a stream from an array and process it
const stream = pipe(
  from([1, 2, 3, 4, 5, 6]),
  filter(x => x % 2 === 0),  // Keep even numbers
  map(x => x * 2)            // Double them
);

const result = await toArray(stream);
console.log(result); // [4, 8, 12]
```

⚠️ReadableStreams are not recoverable. If you start and consume a stream, that instance cannot be reused.  


## API Reference

- **[Creation Functions](docs/creation.md)** - `from()`, `of()`, `timer()`, `interval()`, `range()`, etc.
- **[Consuming Functions](docs/consuming.md)** - `toArray()`, `toPromise()`, `subscribe()`, etc.
- **[Piping](docs/piping.md)** - `pipe()`, `retryPipe()` for chaining operations
- **[Operators](docs/operators.md)** - Transform, filter, and control stream data
- **[Subjects](docs/subjects.md)** - `Subject`, `BehaviorSubject`, `ReplaySubject`
- **[Schedulers](docs/schedulers.md)** - `IdleScheduler`, `FrameScheduler`
- **[Utilities](docs/utilities.md)** - Helper functions and tools
- **[Workers](docs/workers.md)** - Process streams in Web Workers


## Browser Compatibility

This library requires support for:
- ReadableStream (for all functionality)
- WritableStream (for Subjects)
- async/await (ES2017)

For older browsers, use the [web-streams-polyfill](https://www.npmjs.com/package/web-streams-polyfill):

```ts
import 'web-streams-polyfill/polyfill';
import { from, pipe, map } from 'web-streams-extensions';
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

