# Contributing to web-streams-extensions

Thank you for your interest in contributing to web-streams-extensions! This document outlines the process for contributing to the project.

## 🐛 Reporting Bugs

**Important**: All bug reports must include a reproducible failing test case. This is a strict requirement that helps us:
- Understand the exact issue
- Verify the bug exists
- Ensure the fix works correctly
- Prevent regressions

### Bug Report Process

1. **Search existing issues** to make sure your bug hasn't already been reported
2. **Create a failing test** that reproduces the bug
3. **Open a bug report** using our template

### Creating a Failing Test

1. Fork the repository
2. Add your failing test to `spec/failing.spec.ts`
3. Follow this structure:

```typescript
import { expect } from "chai";
import { toArray, from, pipe, yourOperator } from '../src/index.js';

describe("Failing Bug Report", () => {
  it("should reproduce bug with operator XYZ", async () => {
    // Arrange: Set up your test data
    let input = [1, 2, 3, 4];
    let expected = [1, 2, 3]; // What you expect
    
    // Act: Use the operator that has the bug
    let result = await toArray(
      pipe(
        from(input),
        yourOperator(parameters)
      )
    );
    
    // Assert: This should fail due to the bug
    expect(result, "describe what should happen").to.deep.equal(expected);
  });
});
```

4. **Run the test** to confirm it fails:
   ```bash
   npm test
   ```

5. **Include the test** in your bug report or link to your fork

### Example Failing Test

Here's an example of a good failing test for a hypothetical bug:

```typescript
it("should handle empty arrays in concat operator", async () => {
  // Bug: concat operator hangs when processing empty arrays
  let input = [[], [1, 2], []];
  let expected = [1, 2];
  
  let result = await toArray(
    pipe(
      from(input),
      concatAll()
    )
  );
  
  expect(result, "should flatten arrays and skip empty ones").to.deep.equal(expected);
});
```

## ✨ Feature Requests

Before requesting a feature:
1. Check existing issues and discussions
2. Consider if it fits the project's scope
3. Think about backwards compatibility
4. Consider providing an implementation

## 🔧 Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/MeirionHughes/web-streams-extensions.git
   cd web-streams-extensions
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run tests**:
   ```bash
   npm test
   ```

4. **Check coverage**:
   ```bash
   npm run test:cover
   ```

## 📝 Code Standards

### Test Requirements
- **All source files must maintain 85%+ statement coverage**
- New features must include comprehensive tests
- Bug fixes must include regression tests
- Tests should cover edge cases, error scenarios, and cancellation

### Code Style
- Follow existing TypeScript patterns
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Handle errors gracefully
- Support stream cancellation

### Test Structure
Tests should follow this pattern:
- **Arrange**: Set up test data and conditions
- **Act**: Execute the operation being tested
- **Assert**: Verify the results

## 🚀 Pull Request Process

1. **Create a feature branch** from `master`
2. **Make your changes** following our standards
3. **Add/update tests** to maintain coverage requirements
4. **Ensure all tests pass**:
   ```bash
   npm test
   ```
5. **Check coverage meets requirements**:
   ```bash
   npm run test:cover
   ```
6. **Update documentation** if needed
7. **Create a pull request** using our template

### Pull Request Requirements
- [ ] All tests pass
- [ ] Coverage requirements met (85%+ for all src files)
- [ ] No new warnings or errors
- [ ] Documentation updated (if applicable)
- [ ] Breaking changes documented

## 🧪 Testing Guidelines

### Test Categories
1. **Happy path tests**: Normal usage scenarios
2. **Edge case tests**: Empty streams, single elements, large data
3. **Error handling tests**: Invalid inputs, stream errors
4. **Cancellation tests**: Proper cleanup and resource management
5. **Performance tests**: Memory leaks, timing-sensitive operations

### Writing Good Tests
```typescript
describe("operatorName", () => {
  it("should handle normal input", async () => {
    // Test the main functionality
  });
  
  it("should handle empty stream", async () => {
    // Test edge case
  });
  
  it("should handle errors gracefully", async () => {
    // Test error scenarios
  });
  
  it("should support cancellation", async () => {
    // Test cleanup and cancellation
  });
});
```

## 📚 Documentation

- Update README.md for new features
- Add JSDoc comments to public APIs
- Include usage examples
- Update type definitions if needed

## ❓ Questions?

- Check existing [discussions](https://github.com/MeirionHughes/web-streams-extensions/discussions)
- Review the [documentation](https://github.com/MeirionHughes/web-streams-extensions/blob/master/README.md)
- Look at existing tests for examples

## 📄 License

By contributing, you agree that your contributions will be licensed under the same license as the project.
