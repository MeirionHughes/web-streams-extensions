import { UnaryFunction } from "./_op.js";

/**
 * Represents a factory function that creates unary operators.
 * Takes arguments and returns a UnaryFunction that transforms ReadableStreams.
 * 
 * @template I The input type of the stream
 * @template O The output type of the stream  
 * @template A The arguments tuple type for the factory function
 */
export type OpFactory<I, O, A extends any[]> = (...args: A) => UnaryFunction<I, O>;

/**
 * Options for configuring the TransformStream created by toTransform.
 * These options control the queuing strategies for the readable and writable sides.
 * 
 * @template I The input type of the TransformStream
 * @template O The output type of the TransformStream
 */
export interface ToTransformOptions<I = any, O = any> {
  /**
   * Queuing strategy for the writable side of the TransformStream.
   * Controls how chunks are queued when writing to the stream.
   */
  writableStrategy?: QueuingStrategy<I>;

  /**
   * Queuing strategy for the readable side of the TransformStream.
   * Controls how chunks are queued when reading from the stream.
   */
  readableStrategy?: QueuingStrategy<O>;
}

export function toTransform<I, O, A extends any[]>(
  opFactory: OpFactory<I, O, A>
): { new(...args: [...A, ToTransformOptions<I, O>?]): TransformStream<I, O> } {
  return class OpTransformStream extends TransformStream<I, O> {
    constructor(...args: [...A, ToTransformOptions<I, O>?]) {
      // Extract options from the last argument if it's an options object
      let options: ToTransformOptions<I, O> = {};
      let operatorArgs: A;

      // Check if the last argument is an options object
      const lastArg = args[args.length - 1];
      if (lastArg && typeof lastArg === 'object' &&
        (lastArg.hasOwnProperty('writableStrategy') || lastArg.hasOwnProperty('readableStrategy'))) {
        options = lastArg as ToTransformOptions<I, O>;
        operatorArgs = args.slice(0, -1) as unknown as A;
      } else {
        operatorArgs = args as unknown as A;
      }

      // Create the operator function
      const operator = opFactory(...operatorArgs);

      let inputController: ReadableStreamDefaultController<I>;
      let isErrored = false;
      let operatorCompletionPromise: Promise<void>;

      super({
        start(transformController) {
          // Create the synthetic input stream
          const operatorInput = new ReadableStream<I>({
            start(controller) {
              inputController = controller;
            }
          });         

          // Apply the operator to get the output stream
          const operatorOutput = operator(operatorInput);

          // Pipe operator output to transform output and track completion
          operatorCompletionPromise = operatorOutput.pipeTo(new WritableStream({
            write(chunk) {
              try {
                // Check if controller is still open before enqueuing
                if (transformController.desiredSize !== null) {
                  transformController.enqueue(chunk);
                }
              } catch (err) {
                // Transform controller is already erroring, signal to abort the pipe
                throw err;
              }
            },
            close() {
              // Operator output completed, close the input stream and terminate transform
              try {
                inputController.close();
              } catch (error) {
                // Input controller might already be closed, ignore
              }
              if (!isErrored) {
                /** 
                 * this does NOT error the writable. 
                 * this cleanly closes the stream from here 
                 */
                transformController.terminate();
              }
            },
            abort(reason) {
              // The operator stream was aborted, propagate error to transform
              if (!isErrored) {
                isErrored = true;
                transformController.error(reason);
              }
            }
          })).catch(pipeError => {
            // Error during piping, propagate to transform controller
            if (!isErrored) {
              isErrored = true;
              transformController.error(pipeError);
            }
          });
        },

        transform(chunk, controller) {
          // If we're already in error state, don't process more chunks
          if (isErrored) {
            return;
          }
          try {
            inputController.enqueue(chunk);
          } catch (error) {
            //completely ignore backflow errors.
            //the writable side will have closed / errored the overall TranformStream,
            //if the op caused it. otherwise TransformStream will deal with error/abort
          }
        },

        async flush(controller) {
          // Close the input stream to signal completion
          try {
            inputController.close();
          } catch (error) {
            // Input controller might already be closed, ignore
          }
          
          // Wait for the operator to finish processing
          try {
            await operatorCompletionPromise;
          } catch (error) {
            // Error will be handled by the pipe error handler
          }
        }
      }, options.writableStrategy, options.readableStrategy);
    }
  };
}