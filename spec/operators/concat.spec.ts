import { expect } from "chai";
import { toArray, from, pipe, buffer, concat } from '../../src/index.js';
import { Subject } from '../../src/subjects/subject.js';

describe("concat operator", () => {

  it("can concatenate stream of streams ", async () => {
    let input = [from([1, 2]), from([3, 4]), from([5])];
    let expected = [1, 2, 3, 4, 5]

    let result = await toArray(
      pipe(
        from(input),
        concat())
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })

  it("can concatenate stream of promises ", async () => {
    let input = from([Promise.resolve(1), Promise.resolve(2)])
    let expected = [1, 2]

    let result = await toArray(
      pipe(
        input,
        concat())
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  }) 
  
  it("can concatenate stream of arrays ", async () => {
    let input = from([[1,2,3], [4,5,6]])
    let expected = [1, 2, 3, 4, 5, 6]

    let result = await toArray(
      pipe(
        input,
        concat())
    );

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })

  it("should handle empty source stream", async () => {
    let result = await toArray(
      pipe(
        from([]),
        concat()
      )
    );

    expect(result).to.deep.equal([]);
  })

  it("should handle empty arrays", async () => {
    let input = [[], [1, 2], []];
    let expected = [1, 2];

    let result = await toArray(
      pipe(
        from(input),
        concat()
      )
    );

    expect(result).to.deep.equal(expected);
  })

  it("should handle cleanup errors during cancel", async () => {
    const subject = new Subject<ReadableStream<number>>();
    
    const stream = pipe(
      subject.readable,
      concat()
    );
    
    const reader = stream.getReader();
    
    await subject.next(from([1, 2]));
    
    const first = await reader.read();
    expect(first.value).to.equal(1);
    
    // Cancel should handle cleanup gracefully
    await reader.cancel("test");
    reader.releaseLock();
  })

  it("should process streams sequentially, not concurrently", async () => {
    const subject1 = new Subject<number>();
    const subject2 = new Subject<number>();
    
    const resultPromise = toArray(
      pipe(
        from([subject1.readable, subject2.readable]),
        concat()
      )
    );
    
    // Emit to second stream first, but it shouldn't appear until first completes
    await subject2.next(3);
    await subject2.next(4);
    
    // Now complete first stream
    await subject1.next(1);
    await subject1.next(2);
    await subject1.complete();
    
    // Complete second stream
    await subject2.complete();
    
    const result = await resultPromise;
    expect(result).to.deep.equal([1, 2, 3, 4]); // Sequential order maintained
  })

  it("should handle very long sequence of inner streams", async () => {
    const streams = Array.from({ length: 100 }, (_, i) => from([i]));
    const expected = Array.from({ length: 100 }, (_, i) => i);

    const result = await toArray(
      pipe(
        from(streams),
        concat()
      )
    );

    expect(result).to.deep.equal(expected);
  })
});
