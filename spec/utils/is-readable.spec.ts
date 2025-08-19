import { expect } from 'chai';
import { isReadableStream } from '../../src/utils/is-readable.js';


describe('is-readable', () => {
  describe('isReadableStream', () => {
    it('should return true for a real ReadableStream', () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue('test');
          controller.close();
        }
      });
      
      expect(isReadableStream(stream)).to.be.true;
    });

    it('should return true for a ReadableStream with custom source', () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(1);
          controller.enqueue(2);
          controller.close();
        },
        pull() {
          // Custom pull logic
        },
        cancel() {
          // Custom cancel logic
        }
      });
      
      expect(isReadableStream(stream)).to.be.true;
    });

    it('should return false for null', () => {
      expect(isReadableStream(null)).to.be.false;
    });

    it('should return false for undefined', () => {
      expect(isReadableStream(undefined)).to.be.false;
    });

    it('should return false for primitive types', () => {
      expect(isReadableStream(42)).to.be.false;
      expect(isReadableStream('string')).to.be.false;
      expect(isReadableStream(true)).to.be.false;
      expect(isReadableStream(false)).to.be.false;
      expect(isReadableStream(Symbol('test'))).to.be.false;
      expect(isReadableStream(BigInt(123))).to.be.false;
    });

    it('should return false for plain objects', () => {
      expect(isReadableStream({})).to.be.false;
      expect(isReadableStream({ foo: 'bar' })).to.be.false;
    });

    it('should return false for arrays', () => {
      expect(isReadableStream([])).to.be.false;
      expect(isReadableStream([1, 2, 3])).to.be.false;
    });

    it('should return false for functions', () => {
      expect(isReadableStream(function() {})).to.be.false;
      expect(isReadableStream(() => {})).to.be.false;
    });

    it('should return false for objects missing getReader method', () => {
      const fakeStream = {
        cancel: () => {},
        locked: false
      };
      
      expect(isReadableStream(fakeStream)).to.be.false;
    });

    it('should return false for objects with non-function getReader', () => {
      const fakeStream = {
        getReader: 'not a function',
        cancel: () => {},
        locked: false
      };
      
      expect(isReadableStream(fakeStream)).to.be.false;
    });

    it('should return false for objects missing cancel method', () => {
      const fakeStream = {
        getReader: () => {},
        locked: false
      };
      
      expect(isReadableStream(fakeStream)).to.be.false;
    });

    it('should return false for objects with non-function cancel', () => {
      const fakeStream = {
        getReader: () => {},
        cancel: 'not a function',
        locked: false
      };
      
      expect(isReadableStream(fakeStream)).to.be.false;
    });

    it('should return false for objects missing locked property', () => {
      const fakeStream = {
        getReader: () => {},
        cancel: () => {}
      };
      
      expect(isReadableStream(fakeStream)).to.be.false;
    });

    it('should return false for objects with non-boolean locked', () => {
      const fakeStream = {
        getReader: () => {},
        cancel: () => {},
        locked: 'not a boolean'
      };
      
      expect(isReadableStream(fakeStream)).to.be.false;
    });

    it('should return true for objects that fully implement ReadableStream interface', () => {
      const mockStream = {
        getReader: () => ({}),
        cancel: () => Promise.resolve(),
        locked: false,
        pipeThrough: () => ({}),
        pipeTo: () => Promise.resolve(),
        tee: () => [{}, {}]
      };
      
      expect(isReadableStream(mockStream)).to.be.true;
    });

    it('should return true for locked ReadableStream', () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue('test');
          controller.close();
        }
      });
      
      // Lock the stream
      stream.getReader();
      
      expect(isReadableStream(stream)).to.be.true;
      expect(stream.locked).to.be.true;
    });

    it('should handle ReadableStream subclasses', () => {
      // Create a minimal ReadableStream-like object
      class CustomReadableStream {
        getReader() { return {}; }
        cancel() { return Promise.resolve(); }
        get locked() { return false; }
      }
      
      const customStream = new CustomReadableStream();
      expect(isReadableStream(customStream)).to.be.true;
    });

    it('should return false for WritableStream', () => {
      const writableStream = new WritableStream({
        write(chunk) {
          // Write chunk
        }
      });
      
      expect(isReadableStream(writableStream)).to.be.false;
    });

    it('should return false for TransformStream', () => {
      const transformStream = new TransformStream({
        transform(chunk, controller) {
          controller.enqueue(chunk);
        }
      });
      
      expect(isReadableStream(transformStream)).to.be.false;
    });

    it('should return true for TransformStream readable side', () => {
      const transformStream = new TransformStream({
        transform(chunk, controller) {
          controller.enqueue(chunk);
        }
      });
      
      expect(isReadableStream(transformStream.readable)).to.be.true;
    });

    it('should handle objects with getters that throw', () => {
      const fakeStream = {
        get getReader() { throw new Error('Access denied'); },
        cancel: () => {},
        locked: false
      };
      
      expect(() => isReadableStream(fakeStream)).to.throw('Access denied');
    });

    it('should handle objects with getters for required properties', () => {
      const fakeStream = {
        get getReader() { return () => {}; },
        get cancel() { return () => {}; },
        get locked() { return false; }
      };
      
      expect(isReadableStream(fakeStream)).to.be.true;
    });
  });
});