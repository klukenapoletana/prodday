import { describe, it, expect } from 'vitest';
import { recurrenceKind } from './RecurrencePicker.jsx';

// Which of the six choices lights up. 2026-10-28 is a Wednesday, the 28th.
const D = '2026-10-28';

describe('recurrenceKind', () => {
  it('reads the simple choices relative to the task\'s date', () => {
    expect(recurrenceKind(null, D)).toBe('none');
    expect(recurrenceKind({ type: 'daily' }, D)).toBe('daily');
    expect(recurrenceKind({ type: 'weekly', daysOfWeek: [3] }, D)).toBe('weekly');
    expect(recurrenceKind({ type: 'monthly', monthDay: 28, monthWeekday: null }, D)).toBe('monthly');
    expect(recurrenceKind({ type: 'yearly' }, D)).toBe('yearly');
  });

  it('anything the simple choices cannot express is custom', () => {
    expect(recurrenceKind({ type: 'daily', interval: 4 }, D)).toBe('custom');
    expect(recurrenceKind({ type: 'weekly', daysOfWeek: [1, 3] }, D)).toBe('custom');
    expect(recurrenceKind({ type: 'weekly', daysOfWeek: [1] }, D)).toBe('custom');
    expect(recurrenceKind({ type: 'biweekly', daysOfWeek: [3] }, D)).toBe('custom');
    expect(recurrenceKind({ type: 'monthly', monthDay: null, monthWeekday: { week: 4, day: 3 } }, D)).toBe('custom');
    expect(recurrenceKind({ type: 'monthly', monthDay: 15 }, D)).toBe('custom');
    expect(recurrenceKind({ type: 'daily', anchor: 'completion' }, D)).toBe('custom');
  });

  it('end conditions do not make a choice custom', () => {
    expect(recurrenceKind({ type: 'daily', endDate: '2027-01-01' }, D)).toBe('daily');
    expect(recurrenceKind({ type: 'yearly', maxOccurrences: 5 }, D)).toBe('yearly');
  });
});
