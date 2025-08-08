import { expect } from "chai";
import { from, zip, toArray } from '../src/index.js';

describe("Zip", () => {
  describe("Two streams", () => {
    it("should zip two streams without selector (returns tuple)", async () => {
      const numbers = from([1, 2, 3]);
      const letters = from(['a', 'b', 'c', 'X']);
      
      const result = await toArray(zip(numbers, letters));
      
      expect(result).to.deep.equal([
        [1, 'a'],
        [2, 'b'],
        [3, 'c']
      ]);
    });

    it("should zip two streams with selector", async () => {
      const numbers = from([1, 2, 3]);
      const letters = from(['a', 'b', 'c']);
      
      const result = await toArray(zip(numbers, letters, (n, l) => `${n}${l}`));
      
      expect(result).to.deep.equal(['1a', '2b', '3c']);
    });

    it("should handle different types properly", async () => {
      const numbers = from([1, 2, 3]);
      const booleans = from([true, false, true]);
      
      const result = await toArray(zip(numbers, booleans, (n, b) => ({ num: n, bool: b })));
      
      expect(result).to.deep.equal([
        { num: 1, bool: true },
        { num: 2, bool: false },
        { num: 3, bool: true }
      ]);
    });

    it("should complete when first stream completes", async () => {
      const short = from([1, 2]);
      const long = from(['a', 'b', 'c', 'd']);
      
      const result = await toArray(zip(short, long));
      
      expect(result).to.deep.equal([
        [1, 'a'],
        [2, 'b']
      ]);
    });

    it("should complete when second stream completes", async () => {
      const long = from([1, 2, 3, 4]);
      const short = from(['a', 'b']);
      
      const result = await toArray(zip(long, short));
      
      expect(result).to.deep.equal([
        [1, 'a'],
        [2, 'b']
      ]);
    });
  });

  describe("Three streams", () => {
    it("should zip three streams without selector (returns tuple)", async () => {
      const numbers = from([1, 2, 3]);
      const letters = from(['a', 'b', 'c']);
      const symbols = from(['!', '?', '.']);
      
      const result = await toArray(zip(numbers, letters, symbols));
      
      expect(result).to.deep.equal([
        [1, 'a', '!'],
        [2, 'b', '?'],
        [3, 'c', '.']
      ]);
    });

    it("should zip three streams with selector", async () => {
      const numbers = from([1, 2, 3]);
      const letters = from(['a', 'b', 'c']);
      const symbols = from(['!', '?', '.']);
      
      const result = await toArray(zip(numbers, letters, symbols, (n, l, s) => `${n}${l}${s}`));
      
      expect(result).to.deep.equal(['1a!', '2b?', '3c.']);
    });

    it("should handle mixed types with three streams", async () => {
      const numbers = from([1, 2]);
      const strings = from(['hello', 'world']);
      const booleans = from([true, false]);
      
      const result = await toArray(zip(
        numbers, 
        strings, 
        booleans, 
        (n, s, b) => ({ id: n, message: s, active: b })
      ));
      
      expect(result).to.deep.equal([
        { id: 1, message: 'hello', active: true },
        { id: 2, message: 'world', active: false }
      ]);
    });

    it("should complete when any stream completes with three streams", async () => {
      const short = from([1, 2]);
      const medium = from(['a', 'b', 'c']);
      const long = from(['!', '?', '.', '@']);
      
      const result = await toArray(zip(short, medium, long));
      
      expect(result).to.deep.equal([
        [1, 'a', '!'],
        [2, 'b', '?']
      ]);
    });
  });

  describe("Four streams", () => {
    it("should zip four streams without selector", async () => {
      const a = from([1, 2]);
      const b = from(['a', 'b']);
      const c = from([true, false]);
      const d = from(['!', '?']);
      
      const result = await toArray(zip(a, b, c, d));
      
      expect(result).to.deep.equal([
        [1, 'a', true, '!'],
        [2, 'b', false, '?']
      ]);
    });

    it("should zip four streams with selector", async () => {
      const a = from([1, 2]);
      const b = from(['hello', 'world']);
      const c = from([true, false]);
      const d = from(['!', '?']);
      
      const result = await toArray(zip(
        a, b, c, d,
        (num, str, bool, sym) => `${num}:${str}:${bool}${sym}`
      ));
      
      expect(result).to.deep.equal(['1:hello:true!', '2:world:false?']);
    });
  });

  describe("Error handling", () => {
    it("should handle errors in selector function", async () => {
      const numbers = from([1, 2, 3]);
      const letters = from(['a', 'b', 'c']);
      
      const stream = zip(numbers, letters, (n, l) => {
        if (n === 2) throw new Error('Test error');
        return `${n}${l}`;
      });
      
      try {
        await toArray(stream);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Test error');
      }
    });

    it("should handle stream errors", async () => {
      const numbers = from([1, 2, 3]);
      const errorStream = new ReadableStream({
        start(controller) {
          controller.enqueue('a');
          controller.error(new Error('Stream error'));
        }
      });
      
      try {
        await toArray(zip(numbers, errorStream));
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Stream error');
      }
    });

    it("should handle errors in first stream", async () => {
      const errorStream = new ReadableStream({
        start(controller) {
          controller.enqueue(1);
          controller.error(new Error('First stream error'));
        }
      });
      const letters = from(['a', 'b', 'c']);
      
      try {
        await toArray(zip(errorStream, letters));
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('First stream error');
      }
    });

    it("should handle errors in second stream", async () => {
      const numbers = from([1, 2, 3]);
      const errorStream = new ReadableStream({
        start(controller) {
          controller.enqueue('a');
          controller.error(new Error('Second stream error'));
        }
      });
      
      try {
        await toArray(zip(numbers, errorStream));
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Second stream error');
      }
    });
  });

  describe("Edge cases", () => {
    it("should handle empty streams", async () => {
      const empty1 = from([]);
      const empty2 = from([]);
      
      const result = await toArray(zip(empty1, empty2));
      
      expect(result).to.deep.equal([]);
    });

    it("should handle one empty stream", async () => {
      const numbers = from([1, 2, 3]);
      const empty = from([]);
      
      const result = await toArray(zip(numbers, empty));
      
      expect(result).to.deep.equal([]);
    });

    it("should handle single element streams", async () => {
      const single1 = from([42]);
      const single2 = from(['hello']);
      
      const result = await toArray(zip(single1, single2));
      
      expect(result).to.deep.equal([[42, 'hello']]);
    });

    it("should work with async streams", async () => {
      const asyncNumbers = new ReadableStream({
        async start(controller) {
          for (let i = 1; i <= 3; i++) {
            await new Promise(resolve => setTimeout(resolve, 10));
            controller.enqueue(i);
          }
          controller.close();
        }
      });
      
      const letters = from(['a', 'b', 'c']);
      
      const result = await toArray(zip(asyncNumbers, letters, (n, l) => `${n}${l}`));
      
      expect(result).to.deep.equal(['1a', '2b', '3c']);
    });

    it("should handle very fast vs very slow streams", async () => {
      const fast = from([1, 2, 3]);
      const slow = new ReadableStream({
        async start(controller) {
          await new Promise(resolve => setTimeout(resolve, 20));
          controller.enqueue('a');
          await new Promise(resolve => setTimeout(resolve, 20));
          controller.enqueue('b');
          controller.close();
        }
      });
      
      const result = await toArray(zip(fast, slow));
      
      expect(result).to.deep.equal([[1, 'a'], [2, 'b']]);
    });
  });

  describe("Cancellation", () => {
    it("should handle cancellation properly", async () => {
      const numbers = from([1, 2, 3, 4, 5]);
      const letters = from(['a', 'b', 'c', 'd', 'e']);
      
      const stream = zip(numbers, letters);
      const reader = stream.getReader();
      
      // Read first two elements
      const first = await reader.read();
      const second = await reader.read();
      
      expect(first.value).to.deep.equal([1, 'a']);
      expect(second.value).to.deep.equal([2, 'b']);
      
      // Cancel the stream
      await reader.cancel('test cancellation');
      
      // Should be done now
      const third = await reader.read();
      expect(third.done).to.be.true;
    });
  });

  describe("Legacy compatibility", () => {
    it("should still support array format for homogeneous streams", async () => {
      const streams = [
        from([1, 2, 3]),
        from([4, 5, 6]),
        from([7, 8, 9])
      ];
      
      const result = await toArray(zip(streams));
      
      expect(result).to.deep.equal([
        [1, 4, 7],
        [2, 5, 8],
        [3, 6, 9]
      ]);
    });

    it("should handle array format with unequal length streams", async () => {
      const streams = [
        from([1, 2, 3]),
        from([4, 5]),
        from([7, 8, 9, 10])
      ];
      
      const result = await toArray(zip(streams));
      
      expect(result).to.deep.equal([
        [1, 4, 7],
        [2, 5, 8]
      ]);
    });

    it("should handle empty array", async () => {
      const result = await toArray(zip([]));
      expect(result).to.deep.equal([]);
    });

    it("should handle single stream in array", async () => {
      const streams = [from([1, 2, 3])];
      const result = await toArray(zip(streams));
      
      expect(result).to.deep.equal([[1], [2], [3]]);
    });
  });
})