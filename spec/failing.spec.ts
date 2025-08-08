import { expect } from "chai";
import { toArray, of } from '../src/index.js';

/**
 * This file is a placeholder for failing tests during bug reports.
 * 
 * IMPORTANT: When reporting a bug, you MUST provide a failing test that reproduces the issue.
 * 
 * Instructions:
 * 1. Replace the example test below with your failing test
 * 2. Make sure your test fails by running: npm test
 * 3. Include this test in your bug report
 * 
 * Test Structure:
 * - Use descriptive test names that explain the bug
 * - Follow the Arrange-Act-Assert pattern
 * - Include expected vs actual behavior
 * - Test should demonstrate the specific issue
 * 
 * Example:
 * it("should handle empty arrays in concat - currently hangs", async () => {
 *   let input = [[], [1, 2], []];
 *   let expected = [1, 2];
 *   let result = await toArray(pipe(from(input), concatAll()));
 *   expect(result).to.deep.equal(expected);
 * });
 */
describe("Failing Bug Report", () => {
  it("should not error - bug to triarge", async () => {
    // Replace this example test with your failing test case
    let input = [1, 2, 3, 4];
    let expected = input.slice();

    let result = await toArray(of(...input));

    expect(result, "assert message").to.be.deep.eq(expected);
  })
});
