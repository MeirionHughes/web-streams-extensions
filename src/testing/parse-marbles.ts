/**
 * Marble diagram parsing utilities
 */

export interface MarbleEvent<T = any> {
  time: number;
  type: 'next' | 'error' | 'complete';
  value?: T;
}

/**
 * Parses a marble diagram string into timed events.
 * 
 * @param marbles The marble diagram string (e.g., '--a--b--c|')
 * @param values Optional value mapping for symbols
 * @param error Optional error value for # symbol
 * @param subscriptionFrame Optional subscription frame for hot streams
 * @returns Array of timed events
 * @description
 * 
 * Supported syntax:
 * - 'abc-d' - time0: a, time1: b, time2: c, time4: d
 * - '^--a--b' - subscription at time 0, a at time 3, b at time 6
 * - '(abc)' - grouped emissions at same time
 * - '10ms a 20ms b |' - time-based notation (future enhancement)
 * - '^--!--' - subscription markers (future enhancement)
 */
export function parseMarbles<T>(
  marbles: string, 
  values?: Record<string, T> | T[], 
  error?: any,
  subscriptionFrame?: number
): MarbleEvent<T>[] {
  const events: MarbleEvent<T>[] = [];
  let time = 0;
  
  // If subscriptionFrame is explicitly provided, use hot stream logic
  // Otherwise, use cold stream logic (subscription at time 0)
  const isHotStream = subscriptionFrame !== undefined || marbles.includes('^');
  let subscriptionPoint = subscriptionFrame;
  
  // For hot streams, find subscription point if not provided
  if (isHotStream && subscriptionPoint === undefined) {
    let tempTime = 0;
    for (let i = 0; i < marbles.length; i++) {
      const char = marbles[i];
      if (char === '^') {
        subscriptionPoint = tempTime;
        break;
      } else if (char === '-' || /[a-z0-9]/i.test(char)) {
        tempTime += 1;
      }
    }
    
    // If no ^ found in hot stream, assume subscription at 0
    if (subscriptionPoint === undefined) {
      subscriptionPoint = 0;
    }
  }
  
  // For cold streams, subscription point is always 0 (no offset needed)
  if (!isHotStream) {
    subscriptionPoint = 0;
  }
  
  // Auto-conversion function for values
  const getValue = (char: string): T => {
    if (Array.isArray(values)) {
      const index = parseInt(char, 10);
      return isNaN(index) ? char as unknown as T : values[index];
    } else if (values && typeof values === 'object') {
      return values[char] !== undefined ? values[char] : char as unknown as T;
    } else {
      // Auto-convert numbers and keep strings
      const num = Number(char);
      return (isNaN(num) ? char : num) as unknown as T;
    }
  };

  for (let i = 0; i < marbles.length; i++) {
    const char = marbles[i];

    if (char === '|') {
      // For cold streams, include all events; for hot streams, only after subscription
      if (!isHotStream || time >= subscriptionPoint) {
        const eventTime = isHotStream ? time - subscriptionPoint : time;
        events.push({ time: eventTime, type: 'complete' });
      }
      break;
    } else if (char === '#') {
      // For cold streams, include all events; for hot streams, only after subscription
      if (!isHotStream || time >= subscriptionPoint) {
        const eventTime = isHotStream ? time - subscriptionPoint : time;
        events.push({ time: eventTime, type: 'error', value: error || new Error('Stream error') });
      }
      break;
    } else if (char === '^') {
      // Subscription point - doesn't advance time, just marks the subscription frame
      continue;
    } else if (char === '(') {
      // Group of simultaneous events
      i++; // Skip the opening parenthesis
      while (i < marbles.length && marbles[i] !== ')') {
        const groupChar = marbles[i];
        if (/[a-z0-9]/i.test(groupChar)) {
          // For cold streams, include all events; for hot streams, only after subscription
          if (!isHotStream || time >= subscriptionPoint) {
            const eventTime = isHotStream ? time - subscriptionPoint : time;
            events.push({ time: eventTime, type: 'next', value: getValue(groupChar) });
          }
        } else if (groupChar === '|') {
          // Completion in group
          if (!isHotStream || time >= subscriptionPoint) {
            const eventTime = isHotStream ? time - subscriptionPoint : time;
            events.push({ time: eventTime, type: 'complete' });
          }
        } else if (groupChar === '#') {
          // Error in group
          if (!isHotStream || time >= subscriptionPoint) {
            const eventTime = isHotStream ? time - subscriptionPoint : time;
            events.push({ time: eventTime, type: 'error', value: error || new Error('Stream error') });
          }
        }
        i++;
      }
      // i is now at the ')' character
      time += 1; // The entire group takes 1 time unit
      
      // Check if completion or error was in the group - if so, we should break
      if (events.length > 0 && (events[events.length - 1].type === 'complete' || events[events.length - 1].type === 'error')) {
        break;
      }
    } else if (char === '-') {
      // Frame advance
      time += 1;
    } else if (/[a-z0-9]/i.test(char)) {
      // For cold streams, include all events; for hot streams, only after subscription
      if (!isHotStream || time >= subscriptionPoint) {
        const eventTime = isHotStream ? time - subscriptionPoint : time;
        events.push({ time: eventTime, type: 'next', value: getValue(char) });
      }
      time += 1;
    }
  }

  return events;
}

/**
 * Parses time from marble diagram (counts frames).
 * Handles grouped emissions in parentheses as single time units.
 */
export function parseTime(marbles: string): number {
  let time = 0;
  let i = 0;

  while (i < marbles.length) {
    const char = marbles[i];
    
    if (char === '|' || char === '#') {
      time += 1; // Completion and error still count as 1 tick
      break; // Stop after completion or error
    } else if (char === '(') {
      // Handle grouped emissions - find the closing parenthesis
      time += 1; // The entire group counts as 1 tick
      i++; // Skip opening parenthesis
      let depth = 1;
      
      while (i < marbles.length && depth > 0) {
        if (marbles[i] === '(') depth++;
        else if (marbles[i] === ')') depth--;
        i++;
      }
      
      // Check if the group contains completion or error
      const groupContent = marbles.substring(marbles.lastIndexOf('(', i - 1) + 1, i - 1);
      if (groupContent.includes('|') || groupContent.includes('#')) {
        break; // Stop if completion or error is in the group
      }
      
      continue; // Skip the increment at the end of the loop
    } else if (char === '-' || /[a-z0-9]/i.test(char)) {
      time += 1; // 1 tick per frame to match RxJS marble testing
    }
    
    i++;
  }

  return time;
}
