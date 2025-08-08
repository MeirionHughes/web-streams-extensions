import { expect } from "chai";
import { toArray, from, defer } from '../src/index.js';

describe("defer", () => {
  it("can defer stream behind promise", async () => {
    let inputA = [1, 2, 3, 4];
    let expected = inputA;

    let result = await toArray(
      defer(
        ()=>Promise.resolve(from(inputA))
      )
    )

    expect(result, "concat result matches expected").to.be.deep.eq(expected);
  })

  it("can defer direct stream (not promise)", async () => {
    let inputA = [5, 6, 7];
    let expected = inputA;

    let result = await toArray(
      defer(
        () => from(inputA) // Direct ReadableStream, not Promise
      )
    )

    expect(result, "defer direct stream result matches expected").to.be.deep.eq(expected);
  })

  it("handles error in src callback", async () => {
    let errorMessage = "Source creation failed";
    
    try {
      await toArray(
        defer(
          () => {
            throw new Error(errorMessage);
          }
        )
      );
      expect.fail("Should have thrown error");
    } catch (err) {
      expect(err.message).to.include(errorMessage);
    }
  })

  it("handles error in promised src callback", async () => {
    let errorMessage = "Promised source creation failed";
    
    try {
      await toArray(
        defer(
          () => Promise.reject(new Error(errorMessage))
        )
      );
      expect.fail("Should have thrown error");
    } catch (err) {
      expect(err.message).to.include(errorMessage);
    }
  })

  it("handles error during stream reading", async () => {
    let errorMessage = "Stream reading error";
    
    // Create a stream that errors during reading
    let errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.enqueue(2);
      },
      pull(controller) {
        throw new Error(errorMessage);
      }
    });

    try {
      await toArray(
        defer(() => Promise.resolve(errorStream))
      );
      expect.fail("Should have thrown error");
    } catch (err) {
      expect(err.message).to.include(errorMessage);
    }
  })

  it("handles cancellation properly", async () => {
    let cancelled = false;
    let sourceStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.enqueue(2);
        controller.enqueue(3);
      },
      cancel(reason) {
        cancelled = true;
      }
    });

    let deferred = defer(() => Promise.resolve(sourceStream));
    let reader = deferred.getReader();
    
    // Read one value
    let result1 = await reader.read();
    expect(result1.value).to.equal(1);
    
    // Cancel the stream
    await reader.cancel("test cancellation");
    expect(cancelled).to.be.true;
  })

  it("handles reader release errors during cancellation", async () => {
    let sourceStream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
      },
      cancel() {
        // This will cause reader.cancel to potentially throw
        throw new Error("Cancel error");
      }
    });

    let deferred = defer(() => Promise.resolve(sourceStream));
    let reader = deferred.getReader();
    
    // Read one value
    await reader.read();
    
    // This should handle the error gracefully
    try {
      await reader.cancel("test");
    } catch (err) {
      // The cancel error should be handled internally
    }
  })
})