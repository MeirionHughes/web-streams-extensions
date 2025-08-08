import { expect } from "chai";
import { Subject } from "../src/index.js";
import { toArray, from, pipe, filter, buffer, map, first, toPromise } from '../src/index.js';

describe("pipe", () => {
  it("can pipe multiple operators", async () => {
    let inputA = [1, 2, 3, 4];

    let expected = { "1": 1, "2": 2, "4": 4 };

    let result = await toPromise(
      pipe(
        from(inputA),
        filter(x => x != 3),
        buffer(Infinity),
        map(x => {
          return x.reduce((p, c) => { p[c.toString()] = c; return p }, {});
        }),
        first()
      ));

    expect(result, "from stream result matches expected").to.be.deep.eq(expected);
  })

  it("can pipe from readable-like sources (subject)", async () => {
    let inputA = [1, 2, 3, 4];

    let mapper = (x: number) => x * 10;
    let expected = inputA.slice().map(mapper)

    let src = new Subject<number>();

    let resultPromise = toArray(
      pipe(
        src,
        map(mapper)
      ));

    from(inputA).pipeTo(src.writable);

    let result = await resultPromise;

    expect(result, "from stream result matches expected").to.be.deep.eq(expected);
  })


  it("can pipe with TransformStream as operator", async () => {
    let inputA = ["hello", "world", "foo"];
    let expected = ["HELLO", "WORLD", "FOO"];

    // Create a TransformStream that converts to uppercase
    let upperCaseTransform = new TransformStream<string, string>({
      transform(chunk, controller) {
        controller.enqueue(chunk.toUpperCase());
      }
    });

    // Create another TransformStream that adds exclamation
    let exclamationTransform = new TransformStream<string, string>({
      transform(chunk, controller) {
        controller.enqueue(chunk + "!");
      }
    });

    let result = await toArray(
      pipe(
        from(inputA),
        upperCaseTransform, // This should be automatically wrapped with through()
        filter(x => x.includes("O")), // Mix with regular operators - all contain "O" now
        exclamationTransform, // Another TransformStream
        map(x => x.replace("!", "")) // Remove exclamation for expected result
      ));

    expect(result, "TransformStream operators work correctly in pipe").to.be.deep.eq(expected);
  })

  it("cancelled reader reason propagates ", async () => {
    let inputA = [1, 2, 3, 4];

    let expected = 'foo';
    let result = null;


    let src = pipe(
      new ReadableStream({
        cancel(reason) {
          result = reason;
        }
      }),
      filter(x => x != 3),
      buffer(Infinity),
      map(x => {
        return x.reduce((p, c) => { p[c.toString()] = c; return p }, {});
      }),
      first()
    );

    let reader = src.getReader();

    reader.cancel(expected);

    expect(result, "cancel reason was propagated").to.be.deep.eq(expected);
  })

  it("should handle backpressure correctly with highWaterMark", async () => {
    let sourceReadCount = 0;
    let writtenElements = 0;
    let blockingPromiseResolve: (() => void) | null = null;
    const blockingPromise = new Promise<void>(resolve => {
      blockingPromiseResolve = resolve;
    });

    // Create source that tracks how many elements were read
    const source = new ReadableStream({
      start(controller) {
        for (let i = 1; i <= 10; i++) {
          controller.enqueue(i);
        }
        controller.close();
      },
      pull() {
        sourceReadCount++;
      }
    });

    // Create pipe with highWaterMark of 1
    const pipeline = pipe(
      source,
      map((x: number) => x * 2), // Double each value
      { highWaterMark: 1 }
    );

    // Create writable that blocks after 3 elements
    let abortController = new AbortController();
    const blockingWritable = new WritableStream({
      write(chunk) {
        writtenElements++;
        if (writtenElements >= 3) {
          // Signal that we've written 3 elements and are now blocking
          if (blockingPromiseResolve) {
            blockingPromiseResolve();
            blockingPromiseResolve = null;
          }
          // Block indefinitely to simulate backpressure
          return new Promise(() => {}); // Never resolves
        }
      }
    });

    // Start the pipe operation (don't await it since it will block)
    const pipePromise = pipeline.pipeTo(blockingWritable, { 
      signal: abortController.signal 
    }).catch(() => {
      // Ignore cancellation errors
    });

    // Wait for the blocking moment
    await blockingPromise;
    
    // Add a small delay to let the pipe settle
    await new Promise(resolve => setTimeout(resolve, 100));

    // Due to backpressure, the source should have only read a limited number of elements
    // With highWaterMark of 1, we expect roughly 4 elements to be read:
    // - 1 in the readable stream buffer
    // - 1 in the map operator buffer  
    // - 1 in the pipe buffer
    // - 1 currently being processed by the writable
    expect(sourceReadCount, "source should only read limited elements due to backpressure").to.be.lessThanOrEqual(4);
    expect(writtenElements, "exactly 3 elements should be written before blocking").to.equal(3);

    // Clean up - abort the pipeline to stop the infinite promise
    abortController.abort();
  })

})