import { beforeAll, describe, expect, it } from 'vitest';
import i18next from 'i18next';
import { loaders } from '../locales.js';
import { reminderLabel } from './TaskRemindersField.jsx';

const instances = {};
beforeAll(async () => {
  for (const lng of ['en', 'de', 'pl']) {
    const i18n = i18next.createInstance();
    await i18n.init({ lng, fallbackLng: false, resources: { [lng]: { translation: await loaders[lng]() } }, interpolation: { escapeValue: false } });
    instances[lng] = i18n;
  }
});
const label = (lng, r) => reminderLabel({ id: 'x', ...r }, instances[lng].t.bind(instances[lng]), lng);

describe('reminderLabel', () => {
  it('reads each kind in German', () => {
    expect(label('de', { kind: 'before', minutes: 0 })).toBe('Zum Beginn');
    expect(label('de', { kind: 'before', minutes: 15 })).toBe('15 Min. vorher');
    expect(label('de', { kind: 'before', minutes: 120 })).toBe('2 Std. vorher');
    expect(label('de', { kind: 'before', minutes: 1440 })).toBe('1 Tag vorher');
    expect(label('de', { kind: 'day', daysBefore: 0, time: '09:00' })).toBe('Am Tag um 09:00');
    expect(label('de', { kind: 'day', daysBefore: 2, time: '18:00' })).toBe('2 Tage vorher um 18:00');
    expect(label('de', { kind: 'at', at: '2026-11-06T17:00' })).toMatch(/^Fr\.?, 6\. Nov\.?, 17:00$/);
  });

  it('uses each language\'s plural forms', () => {
    expect(label('en', { kind: 'before', minutes: 60 })).toBe('1 hour before');
    expect(label('pl', { kind: 'day', daysBefore: 2, time: '18:00' })).toBe('2 dni wcześniej o 18:00');
    expect(label('pl', { kind: 'before', minutes: 1440 })).toBe('1 dzień wcześniej');
  });

  it('an invalid reminder has no label', () => {
    expect(label('de', { kind: 'later' })).toBe('');
  });
});
