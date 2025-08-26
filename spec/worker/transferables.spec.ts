import { assert, expect } from 'chai';
import { of } from '../../src/of.js';
import { pipe } from '../../src/pipe.js';
import { toArray } from '../../src/to-array.js';
import { bridge } from '../../src/operators/bridge.js';
import { validateTransferableValue, defaultGetTransferables } from '../../src/workers/transferables.js';

// Only create worker if Worker is available (browser environment)
const worker = typeof Worker !== 'undefined' ? new Worker('./spec/worker/bridge-worker.bundle.js') : null;

describe('Transferables and Value Validation', () => {
  describe('validateTransferableValue', () => {
    it('should allow primitive values', () => {
      expect(() => validateTransferableValue(42)).to.not.throw();
      expect(() => validateTransferableValue('hello')).to.not.throw();
      expect(() => validateTransferableValue(true)).to.not.throw();
      expect(() => validateTransferableValue(null)).to.not.throw();
      expect(() => validateTransferableValue(undefined)).to.not.throw();
      expect(() => validateTransferableValue(BigInt(123))).to.not.throw();
    });

    it('should allow plain arrays', () => {
      expect(() => validateTransferableValue([1, 2, 3])).to.not.throw();
      expect(() => validateTransferableValue(['hello', 'world'])).to.not.throw();
      expect(() => validateTransferableValue([true, false])).to.not.throw();
    });

    it('should allow plain objects', () => {
      expect(() => validateTransferableValue({ a: 1, b: 2 })).to.not.throw();
      expect(() => validateTransferableValue({ name: 'test', data: [1, 2, 3] })).to.not.throw();
    });

    it('should allow typed arrays', () => {
      expect(() => validateTransferableValue(new Uint8Array([1, 2, 3]))).to.not.throw();
      expect(() => validateTransferableValue(new Int32Array([1, 2, 3]))).to.not.throw();
      expect(() => validateTransferableValue(new Float64Array([1.1, 2.2]))).to.not.throw();
    });

    it('should allow ArrayBuffers', () => {
      const buffer = new ArrayBuffer(8);
      expect(() => validateTransferableValue(buffer)).to.not.throw();
    });

    it('should reject class instances', () => {
      class TestClass {
        constructor(public value: number) { }
      }

      const instance = new TestClass(42);
      expect(() => validateTransferableValue(instance)).to.throw('class instances are not allowed');
    });

    it('should reject built-in class instances', () => {
      expect(() => validateTransferableValue(new Date())).to.throw('class instances are not allowed');
      expect(() => validateTransferableValue(new Error('test'))).to.throw('class instances are not allowed');
      expect(() => validateTransferableValue(new Map())).to.throw('class instances are not allowed');
      expect(() => validateTransferableValue(new Set())).to.throw('class instances are not allowed');
    });

    it('should provide helpful error messages with path', () => {
      const data = {
        valid: 42,
        invalid: new Date()
      };

      expect(() => validateTransferableValue(data)).to.throw('Invalid value at value.invalid');
    });

    it('should validate nested structures', () => {
      const validNested = {
        level1: {
          level2: {
            array: [1, 2, { nested: 'string' }],
            typed: new Uint8Array([1, 2, 3])
          }
        }
      };

      expect(() => validateTransferableValue(validNested)).to.not.throw();

      const invalidNested = {
        level1: {
          invalid: new Date()
        }
      };

      expect(() => validateTransferableValue(invalidNested)).to.throw('Invalid value at value.level1.invalid');
    });
  });

  describe('defaultGetTransferables', () => {
    it('should detect ArrayBuffers', () => {
      const buffer = new ArrayBuffer(8);
      const transferables = defaultGetTransferables(buffer);
      expect(transferables).to.deep.equal([buffer]);
    });

    it('should NOT transfer ArrayBuffers from typed arrays (let structured clone handle)', () => {
      const typedArray = new Uint8Array([1, 2, 3, 4]);
      const transferables = defaultGetTransferables(typedArray);
      // Structured clone handles TypedArrays efficiently, so don't transfer the buffer
      expect(transferables).to.deep.equal([]);
    });

    it('should find transferables in nested objects but not TypedArray buffers', () => {
      const buffer1 = new ArrayBuffer(8);
      const buffer2 = new ArrayBuffer(16);
      const typedArray = new Uint8Array(buffer1);

      const data = {
        direct: buffer2,  // This should be transferred
        nested: {
          typed: typedArray,  // This should NOT have its buffer transferred
          other: 'string'
        }
      };

      const transferables = defaultGetTransferables(data);
      expect(transferables).to.have.length(1);
      expect(transferables[0]).to.equal(buffer2);  // Only the direct buffer
    });

    it('should find transferables in arrays but not TypedArray buffers', () => {
      const buffer = new ArrayBuffer(8);
      const typedArray = new Uint8Array([1, 2, 3]);

      const data = [buffer, 'string', typedArray, 42];

      const transferables = defaultGetTransferables(data);
      expect(transferables).to.have.length(1);  // Only the direct buffer
      expect(transferables).to.include(buffer);
      // typedArray.buffer should NOT be included - let structured clone handle it
    });

    it('should handle circular references', () => {
      const obj: any = { value: 42 };
      obj.self = obj; // Create circular reference

      expect(() => defaultGetTransferables(obj)).to.not.throw();
    });

    it('should not extract buffers from TypedArrays (structured clone handles them)', () => {
      const buffer = new ArrayBuffer(8);
      const typedArray1 = new Uint8Array(buffer);
      const typedArray2 = new Uint16Array(buffer);

      const data = {
        array1: typedArray1,
        array2: typedArray2
      };

      const transferables = defaultGetTransferables(data);
      expect(transferables).to.deep.equal([]); // No buffers extracted from TypedArrays
    });

    it('should return empty array for non-transferable data', () => {
      const data = {
        string: 'hello',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        nested: { more: 'data' }
      };

      const transferables = defaultGetTransferables(data);
      expect(transferables).to.deep.equal([]);
    });
  });

  describe('Worker Integration with Transferables', () => {
    beforeEach(function() {
      if (!worker) {
        this.skip();
      }
    });
    
    it('should transfer typed arrays efficiently', async () => {
      const source = of(new Uint8Array([1, 2, 3, 4]));

      const stream = pipe(
        source,
        bridge(worker, 'double', {
          validate(value) {
            return value instanceof Uint8Array
          },
        })
      );

      const result = await toArray(stream);

      expect(result).to.have.length(1);
      expect(result[0]).to.be.instanceOf(Uint8Array);
      expect(Array.from(result[0])).to.deep.equal([2, 4, 6, 8]);
    });

    it('should handle mixed transferable and non-transferable data', async () => {
      const originalBuffer = new ArrayBuffer(4); // Match the data size
      const typedArray = new Uint8Array(originalBuffer);
      typedArray.set([5, 10, 15, 20]); // Exactly 4 bytes

      const data = {
        metadata: 'test',
        buffer: typedArray,
        count: 2
      };

      const source = of(data);

      const stream = pipe(
        source,
        bridge(worker, 'passthrough', {
          validate(x): x is typeof data { return true },
        })
      );

      const result = await toArray(stream);

      expect(result).to.have.length(1);
      expect(result[0]).to.be.an('object');
      expect(result[0].metadata).to.equal('test');
      expect(result[0].count).to.equal(2);
      expect(result[0].buffer).to.be.instanceOf(Uint8Array);
      expect(Array.from(result[0].buffer)).to.deep.equal([5, 10, 15, 20]);

      // Verify the buffer was transferred (original should be detached if transferables worked)
      // Note: We can't test detachment directly because the original might be on different thread
      // But we can verify the data integrity
    });

    it('should reject invalid values', async () => {
      class InvalidClass {
        constructor(public value: number) { }
      }

      const source = of(new InvalidClass(42));

      try {
        const stream = pipe(
          source,
          bridge(worker, 'double')
        );

        await toArray(stream);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('class instances are not allowed');
      }
    });

    it('should handle custom getTransferables function', async () => {
      let capturedValue: any = null;
      let getTransferablesCalled = false;

      // Custom function that captures what value was passed and returns no transferables
      const customGetTransferables = (value: any) => {
        getTransferablesCalled = true;
        capturedValue = value;
        return []; // Return no transferables to force copying instead of transfer
      };

      const source = of(new Uint8Array([1, 2, 3, 4]));

      const stream = pipe(
        source,
        bridge(worker, 'double', {
          validate(value) {
            return value instanceof Uint8Array
          },
          getTransferables: customGetTransferables
        })
      );

      const result = await toArray(stream);

      expect(result).to.have.length(1);
      expect(result[0]).to.be.instanceOf(Uint8Array);
      expect(Array.from(result[0])).to.deep.equal([2, 4, 6, 8]);

      // Verify the custom getTransferables function was called with the right value
      expect(getTransferablesCalled).to.be.true;
      expect(capturedValue).to.be.instanceOf(Uint8Array);
      expect(Array.from(capturedValue)).to.deep.equal([1, 2, 3, 4]);
    });

    it('should use structured clone for TypedArrays (no buffer transfer)', async () => {
      let transferablesCalled = false;
      let detectedTransferables: Transferable[] = [];

      // Custom function that captures what transferables were detected
      const capturingGetTransferables = (value: any) => {
        transferablesCalled = true;
        const transferables = defaultGetTransferables(value);
        detectedTransferables = transferables;
        return transferables;
      };

      const originalBuffer = new ArrayBuffer(8); // Match the data size
      const typedArray = new Uint8Array(originalBuffer);
      typedArray.set([1, 2, 3, 4, 5, 6, 7, 8]); // Exactly 8 bytes

      const source = of(typedArray);

      const stream = pipe(
        source,
        bridge(worker, 'passthrough', {
          validate(value) {
            return value instanceof Uint8Array
          },
          getTransferables: capturingGetTransferables
        })
      );

      const result = await toArray(stream);

      expect(result).to.have.length(1);
      expect(result[0]).to.be.instanceOf(Uint8Array);
      expect(Array.from(result[0])).to.deep.equal([1, 2, 3, 4, 5, 6, 7, 8]);

      // Verify transferables were detected but NO buffers were transferred
      // (structured clone handles TypedArrays efficiently)
      expect(transferablesCalled).to.be.true;
      expect(detectedTransferables).to.have.length(0); // No transferables for TypedArrays
    });
  });
});