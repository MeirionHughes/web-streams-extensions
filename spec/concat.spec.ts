import { expect } from "chai";
import { toArray, concat, filter, from, zip, buffer } from '../src/index.js';

describe("steams", () => {
  it("can concat streams", async () => {
    let inputA = [1, 2, 3, 4];
    let inputB = [5, 6, 7, 8];
    let expected = inputA.concat(inputB);
    let result = await toArray(concat(
      new ReadableStream({
        start(controller) {
          for (let item of inputA) {
            controller.enqueue(item);
          }
          controller.close();
        }
      }),
      new ReadableStream({
        start(controller) {
          for (let item of inputB) {
            controller.enqueue(item);
          }
          controller.close();
        }
      })
    ));

    expect(result, "concat result matches expected").to.be.deep.eq(expected);
  })

  it("throws error when no streams provided", () => {
    expect(() => concat()).to.throw("must pass at least 1 stream to concat");
  })

  it("handles single stream", async () => {
    let input = [1, 2, 3];
    let result = await toArray(concat(from(input)));
    expect(result).to.be.deep.eq(input);
  })

  it("handles error in first stream", async () => {
    let errorMessage = "First stream error";
    let errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
      },
      pull(controller) {
        throw new Error(errorMessage);
      }
    });

    try {
      await toArray(concat(errorStream, from([4, 5, 6])));
      expect.fail("Should have thrown error");
    } catch (err) {
      expect(err.message).to.include(errorMessage);
    }
  })

  it("handles error in second stream", async () => {
    let errorMessage = "Second stream error";
    let errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(4);
      },
      pull(controller) {
        throw new Error(errorMessage);
      }
    });

    try {
      await toArray(concat(from([1, 2, 3]), errorStream));
      expect.fail("Should have thrown error");
    } catch (err) {
      expect(err.message).to.include(errorMessage);
    }
  })

  it("handles cancellation properly", async () => {
    let cancelled = false;
    let streamA = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.enqueue(2);
      },
      cancel(reason) {
        cancelled = true;
      }
    });

    let streamB = from([3, 4, 5]);
    let concatenated = concat(streamA, streamB);
    let reader = concatenated.getReader();
    
    // Read one value
    let result1 = await reader.read();
    expect(result1.value).to.equal(1);
    
    // Cancel the stream
    await reader.cancel("test cancellation");
    expect(cancelled).to.be.true;
  })

  it("handles empty streams in sequence", async () => {
    let emptyStream1 = new ReadableStream({
      start(controller) {
        controller.close();
      }
    });
    
    let emptyStream2 = new ReadableStream({
      start(controller) {
        controller.close();
      }
    });

    let dataStream = from([1, 2]);
    
    let result = await toArray(concat(emptyStream1, emptyStream2, dataStream));
    expect(result).to.be.deep.eq([1, 2]);
  })

  it("handles three streams concatenation", async () => {
    let streamA = from([1, 2]);
    let streamB = from([3, 4]);
    let streamC = from([5, 6]);
    
    let result = await toArray(concat(streamA, streamB, streamC));
    expect(result).to.be.deep.eq([1, 2, 3, 4, 5, 6]);
  })

  it("handles reader release errors during cancellation", async () => {
    let sourceStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
      },
      cancel() {
        throw new Error("Cancel error");
      }
    });

    let concatenated = concat(sourceStream);
    let reader = concatenated.getReader();
    
    await reader.read();
    
    // This should handle the error gracefully
    try {
      await reader.cancel("test");
    } catch (err) {
      // The cancel error should be handled internally
    }
  })
})