import { expect } from 'chai';
import { VirtualTimeScheduler } from '../../src/testing/virtual-tick-scheduler.js';
import { parseMarbles } from '../../src/testing/parse-marbles.js';

describe('virtual-tick-scheduler', () => {
  describe('VirtualTimeScheduler timing consistency', () => {
    it('should match parseMarbles timing exactly for cold streams', async () => {
      const scheduler = new VirtualTimeScheduler();
      const marble = '-a-b-c|';
      const values = { a: 1, b: 2, c: 3 };

      // Get ground truth from parseMarbles
      const expectedEvents = parseMarbles(marble, values);

      await scheduler.run(async ({ cold }) => {
        // Create cold stream using the scheduler
        const stream = cold(marble, values);

        // Use expectResult to capture actual timing from the scheduler
        scheduler.expectResult(stream, (actualEvents, scheduledTasks) => {
          scheduler.log('Expected events from parseMarbles:', expectedEvents);
          scheduler.log('Actual events from scheduler:', actualEvents);
          scheduler.log('Scheduled tasks:', scheduledTasks);

          // Verify the number of events match
          expect(actualEvents).to.have.length(expectedEvents.length);

          // Verify each event matches exactly
          for (let i = 0; i < expectedEvents.length; i++) {
            const expected = expectedEvents[i];
            const actual = actualEvents[i];

            expect(actual.tick).to.equal(expected.time,
              `Event ${i} tick mismatch: expected ${expected.time}, got ${actual.tick}`);
            expect(actual.type).to.equal(expected.type,
              `Event ${i} type mismatch: expected ${expected.type}, got ${actual.type}`);

            if (expected.type === 'next') {
              expect(actual.value).to.equal(expected.value,
                `Event ${i} value mismatch: expected ${expected.value}, got ${actual.value}`);
            }

            if (expected.type === 'error') {
              // For errors, we compare the structure rather than exact instance
              expect(actual.value).to.be.instanceOf(Error);
            }
          }
        });
      });
    });

    it('should handle grouped emissions timing correctly', async () => {
      const scheduler = new VirtualTimeScheduler();
      const marble = '(abc)|';
      const values = { a: 10, b: 20, c: 30 };

      const expectedEvents = parseMarbles(marble, values);

      await scheduler.run(async ({ cold }) => {
        const stream = cold(marble, values);

        scheduler.expectResult(stream, (actualEvents, scheduledTasks) => {
          scheduler.log('Grouped emission test:');
          scheduler.log('Expected events from parseMarbles:', expectedEvents);
          scheduler.log('Actual events from scheduler:', actualEvents);

          expect(actualEvents).to.have.length(expectedEvents.length);

          // All 'next' events should occur at tick 0
          const nextEvents = actualEvents.filter(e => e.type === 'next');
          expect(nextEvents).to.have.length(3);
          nextEvents.forEach((event, index) => {
            expect(event.tick).to.equal(0, `Grouped emission ${index} should occur at tick 0`);
            expect(event.value).to.equal(expectedEvents[index].value);
          });

          // Complete event should occur at tick 1
          const completeEvent = actualEvents.find(e => e.type === 'complete');
          expect(completeEvent).to.exist;
          expect(completeEvent!.tick).to.equal(1, 'Complete should occur at tick 1');
        });
      });
    });

    it('should handle complex marble patterns with delays', async () => {
      const scheduler = new VirtualTimeScheduler();
      const marble = '--a--(bc)-d--|';
      const values = { a: 1, b: 2, c: 3, d: 4 };

      const expectedEvents = parseMarbles(marble, values);

      await scheduler.run(async ({ cold }) => {
        const stream = cold(marble, values);

        scheduler.expectResult(stream, (actualEvents, scheduledTasks) => {
          scheduler.log('Complex pattern test:');
          scheduler.log('Expected events from parseMarbles:', expectedEvents);
          scheduler.log('Actual events from scheduler:', actualEvents);
          scheduler.log('Scheduled tasks:', scheduledTasks);

          expect(actualEvents).to.have.length(expectedEvents.length);

          for (let i = 0; i < expectedEvents.length; i++) {
            const expected = expectedEvents[i];
            const actual = actualEvents[i];

            expect(actual.tick).to.equal(expected.time,
              `Complex pattern event ${i} tick mismatch: expected ${expected.time}, got ${actual.tick}`);
            expect(actual.type).to.equal(expected.type,
              `Complex pattern event ${i} type mismatch`);

            if (expected.type === 'next') {
              expect(actual.value).to.equal(expected.value,
                `Complex pattern event ${i} value mismatch`);
            }
          }
        });
      });
    });

    it('should handle error events with correct timing', async () => {
      const scheduler = new VirtualTimeScheduler();
      const marble = 'a-b-#';
      const values = { a: 1, b: 2 };
      const customError = new Error('test error');

      const expectedEvents = parseMarbles(marble, values, customError);

      await scheduler.run(async ({ cold }) => {
        const stream = cold(marble, values, customError);

        scheduler.expectResult(stream, (actualEvents, scheduledTasks) => {
          scheduler.log('Error timing test:');
          scheduler.log('Expected events from parseMarbles:', expectedEvents);
          scheduler.log('Actual events from scheduler:', actualEvents);

          expect(actualEvents).to.have.length(expectedEvents.length);

          // Check that error occurs at the right time
          const errorEvent = actualEvents.find(e => e.type === 'error');
          const expectedErrorEvent = expectedEvents.find(e => e.type === 'error');

          expect(errorEvent).to.exist;
          expect(expectedErrorEvent).to.exist;
          expect(errorEvent!.tick).to.equal(expectedErrorEvent!.time,
            'Error should occur at the correct tick');
          expect(errorEvent!.value).to.equal(customError,
            'Error value should match');
        });
      });
    });

    it('should verify subscription timing for cold streams', async () => {
      const scheduler = new VirtualTimeScheduler();
      const marble = 'a-b-c|';
      const values = { a: 1, b: 2, c: 3 };

      const expectedEvents = parseMarbles(marble, values);

      await scheduler.run(async ({ cold }) => {
        // Cold streams should only start emitting when subscribed to
        const stream = cold(marble, values);

        // Advance time before subscribing to verify cold behavior
        await scheduler.nextTick();
        await scheduler.nextTick();
        const subscriptionTick = scheduler.getCurrentTick();

        scheduler.expectResult(stream, (actualEvents, scheduledTasks) => {
          scheduler.log('Cold stream subscription test:');
          scheduler.log('Subscription tick:', subscriptionTick);
          scheduler.log('Expected events from parseMarbles:', expectedEvents);
          scheduler.log('Actual events from scheduler:', actualEvents);

          // Events should be offset by the subscription time
          for (let i = 0; i < expectedEvents.length; i++) {
            const expected = expectedEvents[i];
            const actual = actualEvents[i];

            // The actual tick should match expected time (relative to subscription)
            expect(actual.tick).to.equal(expected.time,
              `Cold stream event ${i} should occur at relative time ${expected.time}`);
          }
        });
      });
    });    
  });
});