import { describe, it, expect } from 'vitest';
import {
  getOccurrencesInRange, getPendingOccurrence, reanchorCompletionSeries,
  isCompletionAnchored, setRecurrenceAnchor, setRecurrenceInterval, editedSeriesStart,
} from './recurrenceEngine.js';

// "After completion": one open occurrence, the next counted from the day the
// previous one was ticked off. Stamps are local noon so the local day is the
// same in every test time zone.
const stamp = (d) => new Date(`${d}T12:00:00`).toISOString();
const series = (rec, done = {}, extra = {}) => ({
  id: 't1',
  title: 'Pflanzen gießen',
  recurrence: { startDate: '2026-10-01', anchor: 'completion', ...rec },
  completedDates: Object.keys(done),
  completedDatesTimestamps: Object.fromEntries(Object.entries(done).map(([d, at]) => [d, stamp(at)])),
  ...extra,
});

describe('getPendingOccurrence', () => {
  it('is the start date while nothing is done', () => {
    expect(getPendingOccurrence(series({ type: 'daily', interval: 4 }))).toBe('2026-10-01');
  });

  it('counts from the day it was ticked off: on time, late and early', () => {
    const rec = { type: 'daily', interval: 4 };
    expect(getPendingOccurrence(series(rec, { '2026-10-01': '2026-10-01' }))).toBe('2026-10-05');
    expect(getPendingOccurrence(series(rec, { '2026-10-01': '2026-10-03' }))).toBe('2026-10-07');
    // Done two days early on 2026-09-29 still lands four days after the tick.
    expect(getPendingOccurrence(series({ ...rec, startDate: '2026-10-01' }, { '2026-10-01': '2026-09-29' })))
      .toBe('2026-10-03');
  });

  it('is never on or before the last done occurrence', () => {
    // Daily, ticked off a week early: tomorrow-of-the-tick would be before the due date.
    expect(getPendingOccurrence(series({ type: 'daily' }, { '2026-10-10': '2026-10-03' }))).toBe('2026-10-11');
  });

  it('weeks, months and years step by distance only', () => {
    expect(getPendingOccurrence(series({ type: 'weekly', interval: 2, daysOfWeek: [1] }, { '2026-10-01': '2026-10-01' })))
      .toBe('2026-10-15');
    expect(getPendingOccurrence(series({ type: 'biweekly' }, { '2026-10-01': '2026-10-01' }))).toBe('2026-10-15');
    expect(getPendingOccurrence(series({ type: 'monthly', interval: 3 }, { '2026-10-01': '2026-10-02' })))
      .toBe('2027-01-02');
    expect(getPendingOccurrence(series({ type: 'yearly' }, { '2026-10-01': '2026-10-01' }))).toBe('2027-10-01');
  });

  it('clamps a month end', () => {
    expect(getPendingOccurrence(series({ type: 'monthly', startDate: '2027-01-31' }, { '2027-01-31': '2027-01-31' })))
      .toBe('2027-02-28');
  });

  it('a skipped occurrence counts as done, from its own date', () => {
    const t = series({ type: 'daily', interval: 3 }, {}, { exceptions: { '2026-10-01': { skipped: true } } });
    expect(getPendingOccurrence(t)).toBe('2026-10-04');
  });

  it('is unticked back: removing the tick makes the old one open again', () => {
    expect(getPendingOccurrence(series({ type: 'daily', interval: 4 }, {}))).toBe('2026-10-01');
  });

  it('ends at endDate and maxOccurrences', () => {
    expect(getPendingOccurrence(series({ type: 'daily', interval: 4, endDate: '2026-10-04' }, { '2026-10-01': '2026-10-01' })))
      .toBeNull();
    expect(getPendingOccurrence(series({ type: 'daily', maxOccurrences: 1 }, { '2026-10-01': '2026-10-01' }))).toBeNull();
  });
});

describe('getOccurrencesInRange with anchor completion', () => {
  const rec = { type: 'daily', interval: 4 };

  it('shows the done ones where they were due and only one open one, however long the range', () => {
    const t = series(rec, { '2026-10-01': '2026-10-01', '2026-10-05': '2026-10-08' });
    expect(getOccurrencesInRange(t, '2026-09-01', '2027-12-31')).toEqual(['2026-10-01', '2026-10-05', '2026-10-12']);
  });

  it('a missed one stays open, with nothing queued behind it', () => {
    const t = series(rec);
    expect(getOccurrencesInRange(t, '2026-10-01', '2026-10-31')).toEqual(['2026-10-01']);
  });

  it('filters to the range and hides deleted occurrences', () => {
    const t = series(rec, { '2026-10-01': '2026-10-01' }, { exceptions: { '2026-10-01': { deleted: true } } });
    expect(getOccurrencesInRange(t, '2026-10-01', '2026-10-03')).toEqual([]);
    expect(getOccurrencesInRange(t, '2026-10-02', '2026-10-31')).toEqual(['2026-10-05']);
  });

  it('a fixed series with the same fields is unaffected', () => {
    const { anchor: _a, ...fixed } = series(rec).recurrence;
    expect(getOccurrencesInRange({ recurrence: fixed }, '2026-10-01', '2026-10-09'))
      .toEqual(['2026-10-01', '2026-10-05', '2026-10-09']);
  });
});

describe('reanchorCompletionSeries', () => {
  const rec = { type: 'daily', interval: 4 };

  it('moves the open occurrence and the chain with it', () => {
    const t = series(rec, { '2026-10-01': '2026-10-01' }, { exceptions: { '2026-10-05': { title: 'Kakteen', duration: 10 } } });
    const moved = reanchorCompletionSeries(t, '2026-10-05', '2026-10-07', { startTime: '09:00' });
    expect(moved.recurrence.startDate).toBe('2026-10-07');
    expect(getPendingOccurrence(moved)).toBe('2026-10-07');
    expect(moved.exceptions).toEqual({ '2026-10-07': { title: 'Kakteen', duration: 10, startTime: '09:00' } });
    expect(getOccurrencesInRange(moved, '2026-09-01', '2026-12-31')).toEqual(['2026-10-01', '2026-10-07']);
    expect(t.recurrence.startDate).toBe('2026-10-01'); // not mutated
  });

  it('can move it earlier, as long as it stays after the last done one', () => {
    const t = series(rec, { '2026-10-01': '2026-10-01' });
    expect(reanchorCompletionSeries(t, '2026-10-05', '2026-10-02').recurrence.startDate).toBe('2026-10-02');
    expect(reanchorCompletionSeries(t, '2026-10-05', '2026-10-01')).toBeNull();
  });

  it('declines anything but the open occurrence of an after-completion series', () => {
    const t = series(rec, { '2026-10-01': '2026-10-01' });
    expect(reanchorCompletionSeries(t, '2026-10-01', '2026-10-08')).toBeNull();
    const { anchor: _a, ...fixed } = t.recurrence;
    expect(reanchorCompletionSeries({ ...t, recurrence: fixed }, '2026-10-05', '2026-10-08')).toBeNull();
  });
});

describe('anchor helpers', () => {
  it('setRecurrenceAnchor switches and keeps everything else', () => {
    const fixed = { type: 'weekly', interval: 3, daysOfWeek: [2], startDate: '2026-10-01', endDate: '2027-01-01' };
    const after = setRecurrenceAnchor(fixed, 'completion');
    expect(after).toEqual({ ...fixed, anchor: 'completion' });
    expect(isCompletionAnchored(after)).toBe(true);
    expect(setRecurrenceAnchor(after, 'fixed')).toEqual(fixed);
  });

  it('setRecurrenceInterval keeps the anchor', () => {
    const rec = { type: 'daily', startDate: '2026-10-01', anchor: 'completion' };
    expect(setRecurrenceInterval(rec, 'weekly', 2, '2026-10-01').anchor).toBe('completion');
    expect(setRecurrenceInterval(rec, 'daily', 5, '2026-10-01')).toMatchObject({ interval: 5, anchor: 'completion' });
  });

  it('editedSeriesStart keeps the start of an after-completion series', () => {
    expect(editedSeriesStart({ type: 'daily', interval: 4, anchor: 'completion' }, '2026-10-01', '2026-10-03'))
      .toBe('2026-10-01');
  });
});
