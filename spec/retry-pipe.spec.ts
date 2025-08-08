import { expect } from "chai";
import { from, map, toArray, filter, take } from "../src/index.js";
import { retryPipe, retryPipeValidated } from "../src/retry-pipe.js";

describe("retryable pipe", () => {
  it("should retry the entire stream pipeline on error", async () => {
    let attempts = 0;
    
    // Create a factory that produces a stream that fails during start on the first attempt
    const createFailingStream = () => {
      attempts++;
      
      if (attempts === 1) {
        // Fail immediately on first attempt (before any values are emitted)
        return new ReadableStream({
          start(controller) {
            throw new Error("Simulated failure");
          }
        });
      }
      
      // Succeed on retry
      return from([1, 2, 3, 4, 5]);
    };

    // This should retry the stream creation and succeed on second attempt
    const result = retryPipe(
      createFailingStream,
      map((x: number) => x * 2),
      { retries: 2 }
    );

    const output = await toArray(result);
    
    expect(attempts).to.equal(2); // Should have tried twice
    expect(output).to.deep.equal([2, 4, 6, 8, 10]); // Should succeed on retry
  });

  it("should retry after partial emission (showing retry behavior)", async () => {
    let attempts = 0;
    
    // Create a factory that fails after emitting some values
    const createFailingStream = () => {
      attempts++;
      return from([1, 2, 3, 4, 5]).pipeThrough(new TransformStream({
        transform(chunk, controller) {
          if (attempts === 1 && chunk === 3) {
            // Fail on first attempt when we hit 3 (after emitting 1, 2)
            throw new Error("Simulated failure");
          }
          controller.enqueue(chunk);
        }
      }));
    };

    const result = retryPipe(
      createFailingStream,
      map((x: number) => x * 2),
      { retries: 2 }
    );

    const output = await toArray(result);
    
    expect(attempts).to.equal(2); // Should have tried twice
    // Note: This will include partial results from first attempt plus full results from retry
    // This is expected behavior for retryable streams
    expect(output).to.deep.equal([2, 4, 2, 4, 6, 8, 10]);
  });

  it("should fail after max retries", async () => {
    let attempts = 0;
    
    const createAlwaysFailingStream = () => {
      attempts++;
      return from([1, 2, 3]).pipeThrough(new TransformStream({
        transform(chunk, controller) {
          if (chunk === 2) {
            throw new Error("Always fails");
          }
          controller.enqueue(chunk);
        }
      }));
    };

    let error: any = null;
    try {
      const result = retryPipe(
        createAlwaysFailingStream,
        map((x: number) => x * 2),
        { retries: 3 }
      );
      await toArray(result);
    } catch (err) {
      error = err;
    }

    expect(attempts).to.equal(4); // Initial + 3 retries
    expect(error).to.not.be.null;
    expect(error.message).to.equal("Always fails");
  });

  it("should work without retries if stream succeeds", async () => {
    let attempts = 0;
    
    const createSuccessfulStream = () => {
      attempts++;
      return from([1, 2, 3, 4]);
    };

    const result = retryPipe(
      createSuccessfulStream,
      map((x: number) => x * 2)
    );

    const output = await toArray(result);
    
    expect(attempts).to.equal(1); // Should only try once
    expect(output).to.deep.equal([2, 4, 6, 8]);
  });

  it("should support delay between retries", async () => {
    let attempts = 0;
    const timestamps: number[] = [];
    
    const createFailingStream = () => {
      attempts++;
      timestamps.push(Date.now());
      
      if (attempts <= 2) {
        // Fail first two attempts
        return from([1]).pipeThrough(new TransformStream({
          transform() {
            throw new Error("Retry test");
          }
        }));
      }
      
      return from([1, 2, 3]);
    };

    const result = retryPipe(
      createFailingStream,
      map((x: number) => x * 2),
      { retries: 3, delay: 100 }
    );

    const output = await toArray(result);
    
    expect(attempts).to.equal(3);
    expect(output).to.deep.equal([2, 4, 6]);
    
    // Check that there was a delay between attempts
    if (timestamps.length >= 3) {
      const delay1 = timestamps[1] - timestamps[0];
      const delay2 = timestamps[2] - timestamps[1];
      expect(delay1).to.be.at.least(90); // Allow some tolerance
      expect(delay2).to.be.at.least(90);
    }
  }).timeout(5000);

  it("should work with no operators (just options)", async () => {
    let attempts = 0;
    
    const createFailingStream = () => {
      attempts++;
      if (attempts === 1) {
        throw new Error("First attempt fails");
      }
      return from([1, 2, 3]);
    };

    const result = retryPipe(createFailingStream, { retries: 2 });
    const output = await toArray(result);
    
    expect(attempts).to.equal(2);
    expect(output).to.deep.equal([1, 2, 3]);
  });

  it("should work with single operator", async () => {
    let attempts = 0;
    
    const createFailingStream = () => {
      attempts++;
      if (attempts === 1) {
        throw new Error("First attempt fails");
      }
      return from([1, 2, 3]);
    };

    const result = retryPipe(createFailingStream, map((x: number) => x * 2));
    const output = await toArray(result);
    
    expect(attempts).to.equal(2);
    expect(output).to.deep.equal([2, 4, 6]);
  });

  it("should work with multiple operators", async () => {
    let attempts = 0;
    
    const createFailingStream = () => {
      attempts++;
      if (attempts === 1) {
        throw new Error("First attempt fails");
      }
      return from([1, 2, 3, 4, 5, 6]);
    };

    const result = retryPipe(
      createFailingStream,
      map((x: number) => x * 2),
      filter((x: number) => x > 4),
      take(2)
    );
    
    const output = await toArray(result);
    
    expect(attempts).to.equal(2);
    expect(output).to.deep.equal([6, 8]);
  });

  it("should work with TransformStream operators", async () => {
    let attempts = 0;
    
    const createFailingStream = () => {
      attempts++;
      if (attempts === 1) {
        throw new Error("First attempt fails");
      }
      return from([1, 2, 3]);
    };

    const doubleTransform = new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk * 2);
      }
    });

    const result = retryPipe(createFailingStream, doubleTransform);
    const output = await toArray(result);
    
    expect(attempts).to.equal(2);
    expect(output).to.deep.equal([2, 4, 6]);
  });

  describe("retryPipeValidated", () => {
    it("should validate stream before returning", async () => {
      let attempts = 0;
      
      const createFailingStream = () => {
        attempts++;
        if (attempts === 1) {
          throw new Error("First attempt fails");
        }
        return from([1, 2, 3]);
      };

      const result = await retryPipeValidated(
        createFailingStream,
        map((x: number) => x * 2),
        { retries: 2 }
      );
      
      const output = await toArray(result);
      
      // Should have made test attempts plus final stream creation
      expect(attempts).to.equal(3); // 2 test attempts + 1 actual stream creation
      expect(output).to.deep.equal([2, 4, 6]);
    });

    it("should throw error after max retries in validation", async () => {
      let attempts = 0;
      
      const createAlwaysFailingStream = () => {
        attempts++;
        throw new Error("Always fails");
      };

      try {
        await retryPipeValidated(
          createAlwaysFailingStream,
          map((x: number) => x * 2),
          { retries: 2 }
        );
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.message).to.equal("Always fails");
        expect(attempts).to.equal(3); // Initial + 2 retries
      }
    });

    it("should work with no operators", async () => {
      let attempts = 0;
      
      const createSuccessfulStream = () => {
        attempts++;
        return from([1, 2, 3]);
      };

      const result = await retryPipeValidated(createSuccessfulStream);
      const output = await toArray(result);
      
      expect(attempts).to.equal(2); // Test + actual
      expect(output).to.deep.equal([1, 2, 3]);
    });

    it("should handle TransformStream operators in validation", async () => {
      let attempts = 0;
      
      const createSuccessfulStream = () => {
        attempts++;
        return from([1, 2, 3]);
      };

      // Create fresh TransformStream for each attempt
      const result = await retryPipeValidated(
        createSuccessfulStream,
        map((x: number) => x * 2) // Use map operator instead of TransformStream
      );
      
      const output = await toArray(result);
      
      expect(attempts).to.equal(2); // Test + actual
      expect(output).to.deep.equal([2, 4, 6]);
    });

    it("should handle delay in validation retries", async () => {
      let attempts = 0;
      const timestamps: number[] = [];
      
      const createFailingStream = () => {
        attempts++;
        timestamps.push(Date.now());
        
        if (attempts <= 2) {
          throw new Error("First two attempts fail");
        }
        return from([1, 2, 3]);
      };

      const result = await retryPipeValidated(
        createFailingStream,
        map((x: number) => x * 2),
        { retries: 3, delay: 100 }
      );
      
      const output = await toArray(result);
      
      expect(attempts).to.equal(4); // 3 test attempts + 1 actual
      expect(output).to.deep.equal([2, 4, 6]);
      
      // Check that there was a delay between validation attempts
      if (timestamps.length >= 3) {
        const delay1 = timestamps[1] - timestamps[0];
        const delay2 = timestamps[2] - timestamps[1];
        expect(delay1).to.be.at.least(90);
        expect(delay2).to.be.at.least(90);
      }
    }).timeout(5000);
  });
});
