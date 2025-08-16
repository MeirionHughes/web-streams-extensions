import { expect } from 'chai';
import { parseMarbles, parseTime } from '../../src/testing/parse-marbles.js';

describe('parse-marbles', () => {
  describe('parseMarbles', () => {
    describe('Basic marble parsing', () => {
      it('should parse empty marble diagram', () => {
        const result = parseMarbles('|');
        expect(result).to.deep.equal([
          { type: 'complete', time: 0 }
        ]);
      });

      it('should parse single value marble', () => {
        const result = parseMarbles('a|');
        expect(result).to.deep.equal([
          { type: 'next', time: 0, value: 'a' },
          { type: 'complete', time: 1 }
        ]);
      });

      it('should parse multiple values', () => {
        const result = parseMarbles('abc|');
        expect(result).to.deep.equal([
          { type: 'next', time: 0, value: 'a' },
          { type: 'next', time: 1, value: 'b' },
          { type: 'next', time: 2, value: 'c' },
          { type: 'complete', time: 3 }
        ]);
      });

      it('should parse error marble', () => {
        const result = parseMarbles('a#');
        expect(result).to.deep.equal([
          { type: 'next', time: 0, value: 'a' },
          { type: 'error', time: 1, value: new Error('Stream error') }
        ]);
      });

      it('should parse custom error value', () => {
        const customError = new Error('custom error');
        const result = parseMarbles('a#', {}, customError);
        expect(result).to.deep.equal([
          { type: 'next', time: 0, value: 'a' },
          { type: 'error', time: 1, value: customError }
        ]);
      });
    });

    describe('Timing with dashes', () => {
      it('should parse single dash as delay', () => {
        const result = parseMarbles('-a|');
        expect(result).to.deep.equal([
          { type: 'next', time: 1, value: 'a' },
          { type: 'complete', time: 2 }
        ]);
      });

      it('should parse multiple dashes', () => {
        const result = parseMarbles('--a--|');
        expect(result).to.deep.equal([
          { type: 'next', time: 2, value: 'a' },
          { type: 'complete', time: 5 }
        ]);
      });

      it('should parse dashes between values', () => {
        const result = parseMarbles('a-b-c|');
        expect(result).to.deep.equal([
          { type: 'next', time: 0, value: 'a' },
          { type: 'next', time: 2, value: 'b' },
          { type: 'next', time: 4, value: 'c' },
          { type: 'complete', time: 5 }
        ]);
      });

      it('should parse varying dash lengths', () => {
        const result = parseMarbles('a---b-c|');
        expect(result).to.deep.equal([
          { type: 'next', time: 0, value: 'a' },
          { type: 'next', time: 4, value: 'b' },
          { type: 'next', time: 6, value: 'c' },
          { type: 'complete', time: 7 }
        ]);
      });
    });

    describe('Grouped emissions with parentheses', () => {
      it('should parse simple grouped emission', () => {
        const result = parseMarbles('(ab)|');
        expect(result).to.deep.equal([
          { type: 'next', time: 0, value: 'a' },
          { type: 'next', time: 0, value: 'b' },
          { type: 'complete', time: 1 }
        ]);
      });

      it('should parse grouped emission with delay', () => {
        const result = parseMarbles('--(ab)|');
        expect(result).to.deep.equal([
          { type: 'next', time: 2, value: 'a' },
          { type: 'next', time: 2, value: 'b' },
          { type: 'complete', time: 3 }
        ]);
      });

      it('should parse grouped final emission with complete', () => {
        const result = parseMarbles('a(b|)');
        expect(result).to.deep.equal([
          { type: 'next', time: 0, value: 'a' },
          { type: 'next', time: 1, value: 'b' },
          { type: 'complete', time: 1 }
        ]);
      });

      it('should parse multiple grouped emissions', () => {
        const result = parseMarbles('(ab)-(cd)|');
        expect(result).to.deep.equal([
          { type: 'next', time: 0, value: 'a' },
          { type: 'next', time: 0, value: 'b' },
          { type: 'next', time: 2, value: 'c' },
          { type: 'next', time: 2, value: 'd' },
          { type: 'complete', time: 3 }
        ]);
      });

      it('should parse grouped emission with completion', () => {
        const result = parseMarbles('(ab|)');
        expect(result).to.deep.equal([
          { type: 'next', time: 0, value: 'a' },
          { type: 'next', time: 0, value: 'b' },
          { type: 'complete', time: 0 }
        ]);
      });

      it('should parse grouped emission with error', () => {
        const result = parseMarbles('(ab#)');
        expect(result).to.deep.equal([
          { type: 'next', time: 0, value: 'a' },
          { type: 'next', time: 0, value: 'b' },
          { type: 'error', time: 0, value: new Error('Stream error') }
        ]);
      });

      it('should parse nested or complex groupings', () => {
        const result = parseMarbles('a(bc)d|');
        expect(result).to.deep.equal([
          { type: 'next', time: 0, value: 'a' },
          { type: 'next', time: 1, value: 'b' },
          { type: 'next', time: 1, value: 'c' },
          { type: 'next', time: 2, value: 'd' },
          { type: 'complete', time: 3 }
        ]);
      });
    });

    describe('Value substitution', () => {
      it('should substitute single character values', () => {
        const values = { a: 1, b: 2 };
        const result = parseMarbles('ab|', values);
        expect(result).to.deep.equal([
          { type: 'next', time: 0, value: 1 },
          { type: 'next', time: 1, value: 2 },
          { type: 'complete', time: 2 }
        ]);
      });

      it('should substitute complex values', () => {
        const values = { 
          a: { id: 1, name: 'first' }, 
          b: [1, 2, 3] 
        };
        const result = parseMarbles('a-b|', values);
        expect(result).to.deep.equal([
          { type: 'next', time: 0, value: { id: 1, name: 'first' } },
          { type: 'next', time: 2, value: [1, 2, 3] },
          { type: 'complete', time: 3 }
        ]);
      });

      it('should handle missing values gracefully', () => {
        const values = { a: 1 };
        const result = parseMarbles('ab|', values);
        expect(result).to.deep.equal([
          { type: 'next', time: 0, value: 1 },
          { type: 'next', time: 1, value: 'b' }, // falls back to character
          { type: 'complete', time: 2 }
        ]);
      });

      it('should substitute in grouped emissions', () => {
        const values = { a: 10, b: 20, c: 30 };
        const result = parseMarbles('(abc)|', values);
        expect(result).to.deep.equal([
          { type: 'next', time: 0, value: 10 },
          { type: 'next', time: 0, value: 20 },
          { type: 'next', time: 0, value: 30 },
          { type: 'complete', time: 1 }
        ]);
      });
    });

    describe('Hot stream subscription point (^)', () => {
      it('should parse subscription point at start', () => {
        const result = parseMarbles('^abc|');
        expect(result).to.deep.equal([
          { type: 'next', time: 0, value: 'a' },
          { type: 'next', time: 1, value: 'b' },
          { type: 'next', time: 2, value: 'c' },
          { type: 'complete', time: 3 }
        ]);
      });

      it('should parse subscription point with delay', () => {
        const result = parseMarbles('--^-a-b|');
        expect(result).to.deep.equal([
          { type: 'next', time: 1, value: 'a' },
          { type: 'next', time: 3, value: 'b' },
          { type: 'complete', time: 4 }
        ]);
      });

      it('should parse subscription point in middle', () => {
        const result = parseMarbles('a-^-b-c|');
        expect(result).to.deep.equal([
          { type: 'next', time: 1, value: 'b' },
          { type: 'next', time: 3, value: 'c' },
          { type: 'complete', time: 4 }
        ]);
      });

      it('should handle subscription point at end', () => {
        const result = parseMarbles('abc^|');
        expect(result).to.deep.equal([
          { type: 'complete', time: 0 }
        ]);
      });
    });

    describe('Complex marble patterns', () => {
      it('should parse RxJS-style marble with all features', () => {
        const values = { a: 1, b: 2, c: 3, d: 4 };
        const result = parseMarbles('--^--a--(bc)-d--|', values);
        expect(result).to.deep.equal([
          { type: 'next', time: 2, value: 1 },
          { type: 'next', time: 5, value: 2 },
          { type: 'next', time: 5, value: 3 },
          { type: 'next', time: 7, value: 4 },
          { type: 'complete', time: 10 }
        ]);
      });

      it('should parse long delay patterns', () => {
        const result = parseMarbles('a--------b|');
        expect(result).to.deep.equal([
          { type: 'next', time: 0, value: 'a' },
          { type: 'next', time: 9, value: 'b' },
          { type: 'complete', time: 10 }
        ]);
      });

      it('should parse rapid emissions followed by delay', () => {
        const result = parseMarbles('(abcd)-----|');
        expect(result).to.deep.equal([
          { type: 'next', time: 0, value: 'a' },
          { type: 'next', time: 0, value: 'b' },
          { type: 'next', time: 0, value: 'c' },
          { type: 'next', time: 0, value: 'd' },
          { type: 'complete', time: 6 }
        ]);
      });
    });

    describe('Edge cases and error handling', () => {
      it('should handle empty string', () => {
        const result = parseMarbles('');
        expect(result).to.deep.equal([]);
      });

      it('should handle only dashes', () => {
        const result = parseMarbles('-----');
        expect(result).to.deep.equal([]);
      });

      it('should handle only completion', () => {
        const result = parseMarbles('|');
        expect(result).to.deep.equal([
          { type: 'complete', time: 0 }
        ]);
      });

      it('should handle only error', () => {
        const result = parseMarbles('#');
        expect(result).to.deep.equal([
          { type: 'error', time: 0, value: new Error('Stream error') }
        ]);
      });

      it('should handle malformed parentheses gracefully', () => {
        const result = parseMarbles('a(bc|');
        // Should still parse as best as possible
        expect(result.length).to.be.greaterThan(0);
        expect(result[0]).to.deep.equal({ type: 'next', time: 0, value: 'a' });
      });

      it('should handle special characters in values', () => {
        const values = { 
          '1': 'number one',
          'a': 'letter a',
          'x': 'letter x'
        };
        const result = parseMarbles('1ax|', values);
        expect(result).to.deep.equal([
          { type: 'next', time: 0, value: 'number one' },
          { type: 'next', time: 1, value: 'letter a' },
          { type: 'next', time: 2, value: 'letter x' },
          { type: 'complete', time: 3 }
        ]);
      });
    });
  });

  describe('parseTime', () => {
    describe('Basic time parsing', () => {
      it('should parse empty string as 0', () => {
        expect(parseTime('')).to.equal(0);
      });

      it('should parse completion as 1 tick', () => {
        expect(parseTime('|')).to.equal(1);
      });

      it('should parse error as 1 tick', () => {
        expect(parseTime('#')).to.equal(1);
      });

      it('should parse single character as 1 tick', () => {
        expect(parseTime('a')).to.equal(1);
      });

      it('should parse multiple characters', () => {
        expect(parseTime('abc')).to.equal(3);
      });
    });

    describe('Timing with dashes', () => {
      it('should count dashes as time units', () => {
        expect(parseTime('-')).to.equal(1);
        expect(parseTime('--')).to.equal(2);
        expect(parseTime('-----')).to.equal(5);
      });

      it('should count mixed dashes and values', () => {
        expect(parseTime('-a-')).to.equal(3);
        expect(parseTime('--a--b--')).to.equal(8);
      });

      it('should count complex patterns', () => {
        expect(parseTime('a---b-c|')).to.equal(8);
      });
    });

    describe('Grouped emissions timing', () => {
      it('should count grouped emission as 1 tick', () => {
        expect(parseTime('(ab)')).to.equal(1);
        expect(parseTime('(abc)')).to.equal(1);
        expect(parseTime('(abcdef)')).to.equal(1);
      });

      it('should count grouped emission with completion', () => {
        expect(parseTime('(ab|)')).to.equal(1);
        expect(parseTime('(abc|)')).to.equal(1);
      });

      it('should count grouped emission with error', () => {
        expect(parseTime('(ab#)')).to.equal(1);
      });

      it('should count multiple grouped emissions', () => {
        expect(parseTime('(ab)(cd)')).to.equal(2);
        expect(parseTime('(ab)-(cd)')).to.equal(3);
        expect(parseTime('(ab)--(cd)')).to.equal(4);
      });

      it('should count mixed grouped and individual', () => {
        expect(parseTime('a(bc)d')).to.equal(3); // a=1, (bc)=1, d=1
        expect(parseTime('(ab)-c-(de)')).to.equal(5); // (ab)=1, -=1, c=1, -=1, (de)=1
      });
    });

    describe('Hot stream subscription timing', () => {
      it('should handle subscription point', () => {
        expect(parseTime('^abc|')).to.equal(4); // ^=0, a=1, b=1, c=1, |=1
        expect(parseTime('--^-a-b|')).to.equal(7); // -=1, -=1, ^=0, -=1, a=1, -=1, b=1, |=1
      });

      it('should count from subscription point', () => {
        expect(parseTime('ab^cd|')).to.equal(5); // a=1, b=1, ^=0, c=1, d=1, |=1
        expect(parseTime('---^--a--|')).to.equal(9); // -=1, -=1, -=1, ^=0, -=1, -=1, a=1, -=1, -=1, |=1
      });
    });

    describe('Complex timing patterns', () => {
      it('should handle RxJS-style patterns', () => {
        expect(parseTime('--a--(bc)-d--|')).to.equal(11); // -=1, -=1, a=1, -=1, -=1, (bc)=1, -=1, d=1, -=1, -=1, |=1
        expect(parseTime('^--a--(bc)-d--|')).to.equal(11); // ^=0, -=1, -=1, a=1, -=1, -=1, (bc)=1, -=1, d=1, -=1, -=1, |=1
      });

      it('should handle rapid then slow patterns', () => {
        expect(parseTime('(abcd)-----|')).to.equal(7);
      });

      it('should handle slow then rapid patterns', () => {
        expect(parseTime('------(abcd)|')).to.equal(8);
      });

      it('should handle alternating patterns', () => {
        expect(parseTime('a-(bc)--d-(ef)|')).to.equal(9);
      });
    });

    describe('Edge cases', () => {
      it('should handle only special characters', () => {
        expect(parseTime('|')).to.equal(1);
        expect(parseTime('#')).to.equal(1);
        expect(parseTime('^')).to.equal(0);
      });

      it('should handle empty groups', () => {
        expect(parseTime('()')).to.equal(1);
        expect(parseTime('a()b')).to.equal(3);
      });

      it('should handle consecutive groups', () => {
        expect(parseTime('(ab)(cd)(ef)')).to.equal(3);
      });
    });
  });

  describe('Timing consistency', () => {
    it('should have consistent timing between parseMarbles and parseTime', () => {
      const testCases = [
        'a|',
        'abc|',
        '-a-b-c|',
        '(abc)|',
        '(ab)-(cd)|',
        'a--------b|',
        '(abcd)-----|'
      ];

      testCases.forEach(marble => {
        const events = parseMarbles(marble);
        const expectedTime = parseTime(marble);
        
        // For cold streams (no ^), completion time should match parseTime - 1
        const completionEvent = events.find(e => e.type === 'complete');
        if (completionEvent) {
          expect(completionEvent.time).to.equal(expectedTime - 1, 
            `Completion timing mismatch for "${marble}"`);
        }
      });
    });

    it('should correctly calculate time for grouped emissions', () => {
      // Grouped emissions should all occur at the same time
      const result = parseMarbles('(abc)');
      const times = result.map(e => e.time);
      expect(times.every(t => t === 0)).to.be.true;
      expect(parseTime('(abc)')).to.equal(1);
    });

    it('should correctly handle subscription offset timing', () => {
      const result = parseMarbles('--^-a-b|');
      const firstEvent = result.find(e => e.type === 'next');
      expect(firstEvent?.time).to.equal(1); // 1 tick after subscription
      expect(parseTime('--^-a-b|')).to.equal(7); // Total time including pre-subscription
    });
  });
});
