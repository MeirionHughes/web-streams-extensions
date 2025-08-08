import { describe, it } from "mocha";
import { expect } from "chai";
import { from, pipe, toArray, distinct } from "../../src/index.js";

describe("distinct", () => {
  it("should filter out duplicates", async () => {
    const result = await toArray(pipe(
      from([1, 2, 2, 3, 1, 4, 3]),
      distinct()
    ));
    expect(result).to.deep.equal([1, 2, 3, 4]);
  });

  it("should work with key selector", async () => {
    const result = await toArray(pipe(
      from([
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
        { id: 1, name: 'John Doe' },
        { id: 3, name: 'Bob' }
      ]),
      distinct(person => person.id)
    ));
    expect(result.length).to.equal(3);
    expect(result.map(p => p.id)).to.deep.equal([1, 2, 3]);
  });
});
