import { expect } from "chai";
import { toArray, from, Subject } from '../src/index.js';
import { subscribe } from "../src/subscribe.js";

describe("subscribe", () => {
  it("can subscribe and consume a stream", async () => {
    let inputA = [1, 2, 3, 4];

    let expected = inputA.slice();


    let result = await new Promise((complete, error) => {
      let tmp: number[] = [];
      let disposer = subscribe(from(inputA),
        (next) => { tmp.push(next) },
        () => complete(tmp),
        (err) => error(err));
    })

    expect(result, "from stream result matches expected").to.be.deep.eq(expected);
  })

  it("subscribe is closed when disposed", async () => {
    let inputA = [1, 2, 3, 4];

    let expected = inputA.slice();

    let src = new Subject();

    let sub = subscribe(src, (next) => {});

    sub.unsubscribe();



    expect(sub.closed, "from stream result matches expected").to.be.eq(true);
  })


  it("can subscribe and dispose before reading the whole stream", async () => {
    let inputA = [1, 2, 3, 4];
    let expected = [1, 2];

    let result = await new Promise((complete, error) => {
      let count = 0;
      let tmp: number[] = [];
      let sub = subscribe(from(inputA),
        (next) => { 

          tmp.push(next); if (++count >= 2) { sub.unsubscribe() } },
        () => {

          complete(tmp)
        }
          ,
        (err) => {
   
          error(err)
        }
        );
    })

    expect(result, "from stream result matches expected").to.be.deep.eq(expected);
  })

  it("can subscribe and catch error thrown from producer", async () => {
    let inputA = function* () { yield 1; yield 2; throw Error("Foo") }
    let result = null;

    try {
      await new Promise<void>((complete, error) => {
        subscribe(
          from(inputA),
          (next) => {},
          () => complete(),
          (err) => error(err));
      });
    } catch (err) {
      result = err;
    }

    expect(result).to.not.be.null;
  
    expect(result.message).to.be.eql("Foo");
  })

  it("should handle errors in next callback", async () => {
    let errorCaught = false;
    let completeCalled = false;
    let values: number[] = [];
    
    await new Promise<void>((resolve) => {
      subscribe(
        from([1, 2, 3]),
        (next) => {
          values.push(next);
          if (next === 2) {
            throw new Error("Next callback error");
          }
        },
        () => {
          completeCalled = true;
          resolve();
        },
        (err) => {
          errorCaught = true;
          expect(err.message).to.equal("Next callback error");
          resolve();
        }
      );
    });
    
    expect(errorCaught).to.be.true;
    expect(completeCalled).to.be.false; // Should NOT complete when error occurs
    expect(values).to.deep.equal([1, 2]); // Should process up to the error
  });

  it("should handle errors in complete callback", async () => {
    let completed = false;
    
    const sub = subscribe(
      from([1, 2, 3]),
      (next) => {
        // Normal processing
      },
      () => {
        completed = true;
        throw new Error("Complete callback error"); // This should be ignored
      }
    );

    // Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 50));
    
    expect(completed).to.be.true;
  });

  it("should handle errors in error callback", async () => {
    let errorCallbackCalled = false;
    
    const errorStream = new ReadableStream({
      start(controller) {
        controller.error(new Error("Stream error"));
      }
    });

    const sub = subscribe(
      errorStream,
      (next) => {
        // Should not be called
      },
      () => {
        // Should not be called
      },
      (err) => {
        errorCallbackCalled = true;
        throw new Error("Error callback error"); // This should be ignored
      }
    );

    // Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 50));
    
    expect(errorCallbackCalled).to.be.true;
  });

  it("should handle multiple unsubscribe calls safely", async () => {
    const sub = subscribe(
      from([1, 2, 3]),
      (next) => {},
      () => {}
    );

    // Call unsubscribe multiple times
    sub.unsubscribe();
    sub.unsubscribe();
    sub.unsubscribe();

    expect(sub.closed).to.be.true;
  });

  it("should handle complete without complete callback", async () => {
    let values: number[] = [];
    
    await new Promise<void>((resolve) => {
      const sub = subscribe(
        from([1, 2, 3]),
        (next) => {
          values.push(next);
          if (values.length === 3) {
            // Give a bit of time for completion
            setTimeout(resolve, 50);
          }
        }
        // No complete callback
      );
    });

    expect(values).to.deep.equal([1, 2, 3]);
  });

  it("should handle error without error callback", async () => {
    const errorStream = new ReadableStream({
      start(controller) {
        controller.error(new Error("Stream error"));
      }
    });

    const sub = subscribe(
      errorStream,
      (next) => {
        // Should not be called
      }
      // No complete or error callbacks
    );

    // Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 50));
    
    expect(sub.closed).to.be.true;
  });

  it("should handle cleanup errors during unsubscribe", async () => {
    // Create a mock reader that throws on cancel
    const mockStream = {
      getReader() {
        return {
          read() {
            return Promise.resolve({ done: false, value: 1 });
          },
          cancel() {
            throw new Error("Cancel error");
          },
          releaseLock() {
            // Normal release
          }
        };
      }
    } as unknown as ReadableStream<number>;

    const sub = subscribe(
      mockStream,
      (next) => {}
    );

    // This should handle the cancel error gracefully
    sub.unsubscribe();
    
    expect(sub.closed).to.be.true;
  });

  it("should not call complete callback if already closed", async () => {
    let completeCallCount = 0;
    let values: number[] = [];
    
    const sub = subscribe(
      from([1, 2, 3]),
      (next) => {
        values.push(next);
        if (values.length === 2) {
          sub.unsubscribe(); // Close early
        }
      },
      () => {
        completeCallCount++;
      }
    );

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(values).to.deep.equal([1, 2]);
    expect(completeCallCount).to.equal(1); // Should be called once during unsubscribe
  });

  it("should not call error callback if already closed", async () => {
    let errorCallCount = 0;
    
    const subject = new Subject<number>();
    
    const sub = subscribe(
      subject.readable,
      (next) => {
        // Normal processing
      },
      () => {
        // Complete
      },
      (err) => {
        errorCallCount++;
      }
    );

    sub.unsubscribe(); // Close first
    subject.error(new Error("Test error")); // Then try to error
    
    expect(errorCallCount).to.equal(0); // Should not be called
  });
})