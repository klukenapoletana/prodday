import { beforeAll, describe, expect, it } from 'vitest';
import i18next from 'i18next';
import { loaders } from '../locales.js';
import { getRecurrenceLabel } from './taskUtils.js';

// Labels for series with an interval ("every 4 days"), in English, German and
// Polish, whose few/many plural forms differ ("co 3 dni", "co 5 tygodni").
// Without an interval every label reads as before.

const instances = {};
beforeAll(async () => {
  for (const lng of ['en', 'de', 'pl']) {
    const i18n = i18next.createInstance();
    await i18n.init({ lng, fallbackLng: false, resources: { [lng]: { translation: await loaders[lng]() } }, interpolation: { escapeValue: false } });
    instances[lng] = i18n;
  }
});
const label = (lng, rec) => getRecurrenceLabel(rec, instances[lng].t.bind(instances[lng]), lng);

describe('getRecurrenceLabel with an interval', () => {
  it('names each unit with its count', () => {
    expect(label('en', { type: 'daily', interval: 4 })).toBe('Every 4 days');
    expect(label('de', { type: 'daily', interval: 4 })).toBe('Alle 4 Tage');
    expect(label('de', { type: 'weekly', interval: 3, daysOfWeek: [1] })).toBe('Alle 3 Wochen am Mo');
    expect(label('de', { type: 'monthly', interval: 2, monthDay: 15 })).toBe('Alle 2 Monate am 15.');
    expect(label('de', { type: 'yearly', interval: 2, startDate: '2026-05-04' })).toBe('Alle 2 Jahre am 4. Mai');
  });

  it('uses the language\'s own plural forms', () => {
    expect(label('pl', { type: 'daily', interval: 3 })).toBe('Co 3 dni');
    expect(label('pl', { type: 'weekly', interval: 3 })).toBe('Co 3 tygodnie');
    expect(label('pl', { type: 'weekly', interval: 5 })).toBe('Co 5 tygodni');
    expect(label('pl', { type: 'yearly', interval: 22 })).toBe('Co 22 lata');
  });

  it('reads exactly as before without an interval', () => {
    expect(label('de', { type: 'daily' })).toBe('Jeden Tag');
    expect(label('de', { type: 'daily', interval: 1 })).toBe('Jeden Tag');
    expect(label('de', { type: 'monthly', monthDay: 15 })).toBe('Monatlich am 15.');
    expect(label('de', { type: 'biweekly', daysOfWeek: [1] })).toBe('Alle 2 Wochen am Mo');
  });

  it('keeps the end condition on an interval label', () => {
    expect(label('de', { type: 'daily', interval: 4, maxOccurrences: 5 })).toBe('Alle 4 Tage (5 Mal)');
  });
});

describe('getRecurrenceLabel after completion', () => {
  it('names only the distance, then "after completion"', () => {
    const after = (rec) => ({ ...rec, anchor: 'completion' });
    expect(label('de', after({ type: 'daily', interval: 4 }))).toBe('Alle 4 Tage ab Erledigung');
    expect(label('de', after({ type: 'daily' }))).toBe('Jeden Tag ab Erledigung');
    expect(label('de', after({ type: 'weekly', interval: 3, daysOfWeek: [1] }))).toBe('Alle 3 Wochen ab Erledigung');
    expect(label('de', after({ type: 'biweekly', daysOfWeek: [1] }))).toBe('Alle 2 Wochen ab Erledigung');
    expect(label('de', after({ type: 'monthly', monthDay: 15 }))).toBe('Jeden Monat ab Erledigung');
    expect(label('en', after({ type: 'yearly', interval: 2, startDate: '2026-05-04' }))).toBe('Every 2 years after completion');
    expect(label('pl', after({ type: 'weekly', interval: 5 }))).toBe('Co 5 tygodni od wykonania');
  });
});
