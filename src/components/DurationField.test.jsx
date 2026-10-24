import React, { useState } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import { act, create } from 'react-test-renderer';
import i18next from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { loaders } from '../locales.js';
import DurationField, { parseDurationInput } from './DurationField.jsx';

// A task's duration field: the presets, plus any whole number of minutes
// typed after "Other duration…". Only valid minutes ever reach the task.

const OPTIONS = [15, 30, 45, 60, 90, 120];

let i18n;
beforeAll(async () => {
  const bundle = await loaders.en();
  i18n = i18next.createInstance();
  await i18n.init({ lng: 'en', fallbackLng: false, resources: { en: { translation: bundle } }, interpolation: { escapeValue: false } });
});

// The field inside a parent that owns the task's duration, as the modals do.
function mount(initial) {
  const reported = [];
  const Host = () => {
    const [value, setValue] = useState(initial);
    return (
      <DurationField
        value={value}
        onChange={(m) => { reported.push(m); setValue(m); }}
        options={OPTIONS}
        className="w-full px-3"
      />
    );
  };
  let root;
  act(() => { root = create(<I18nextProvider i18n={i18n}><Host /></I18nextProvider>); });
  const select = () => root.root.findByType('select');
  const input = () => root.root.findAllByType('input')[0] ?? null;
  return { root, reported, select, input };
}

describe('parseDurationInput', () => {
  it('accepts whole minutes from 1 to 24 hours', () => {
    expect(parseDurationInput('1')).toBe(1);
    expect(parseDurationInput(' 50 ')).toBe(50);
    expect(parseDurationInput('1440')).toBe(1440);
  });

  it('rejects empty, fractional, out-of-range and non-numeric input', () => {
    for (const raw of ['', '   ', '0', '-5', '12.5', '1441', 'abc', null, undefined]) {
      expect(parseDurationInput(raw)).toBe(null);
    }
  });
});

describe('DurationField', () => {
  it('shows a preset in the select, with no minutes field', () => {
    const { select, input } = mount(30);
    expect(select().props.value).toBe(30);
    expect(input()).toBe(null);
  });

  it('opens on the minutes field for a duration that is not a preset', () => {
    const { select, input } = mount(50);
    expect(select().props.value).toBe('custom');
    expect(input().props.value).toBe('50');
  });

  it('treats a duration stored as text like the number it is', () => {
    const { select, input } = mount('45');
    expect(select().props.value).toBe(45);
    expect(input()).toBe(null);
  });

  it('reports a chosen preset', () => {
    const { select, reported } = mount(30);
    act(() => { select().props.onChange({ target: { value: '90' } }); });
    expect(reported).toEqual([90]);
  });

  it('"Other duration…" opens the field without changing the duration', () => {
    const { select, input, reported } = mount(30);
    act(() => { select().props.onChange({ target: { value: 'custom' } }); });
    expect(reported).toEqual([]);
    expect(input().props.value).toBe('30');
  });

  it('reports typed minutes as they become valid, never NaN or an out-of-range value', () => {
    const { select, input, reported } = mount(30);
    act(() => { select().props.onChange({ target: { value: 'custom' } }); });
    act(() => { input().props.onChange({ target: { value: '' } }); });
    act(() => { input().props.onChange({ target: { value: '7' } }); });
    act(() => { input().props.onChange({ target: { value: '75' } }); });
    act(() => { input().props.onChange({ target: { value: '9999' } }); });
    expect(reported).toEqual([7, 75]);
    expect(reported.every(Number.isInteger)).toBe(true);
  });

  it('restores the last valid duration when an invalid entry is left', () => {
    const { select, input } = mount(30);
    act(() => { select().props.onChange({ target: { value: 'custom' } }); });
    act(() => { input().props.onChange({ target: { value: '' } }); });
    act(() => { input().props.onBlur(); });
    expect(input().props.value).toBe('30');
  });

  it('keeps the field open when the typed minutes happen to equal a preset', () => {
    const { select, input } = mount(50);
    act(() => { input().props.onChange({ target: { value: '60' } }); });
    expect(select().props.value).toBe('custom');
    expect(input().props.value).toBe('60');
  });

  it('closes the field again when a preset is chosen', () => {
    const { select, input } = mount(50);
    act(() => { select().props.onChange({ target: { value: '45' } }); });
    expect(select().props.value).toBe(45);
    expect(input()).toBe(null);
  });

  it('gives the minutes field the select styling without its full width', () => {
    const { input } = mount(50);
    expect(input().props.className).not.toMatch(/\bw-full\b/);
    expect(input().props.className).toMatch(/\bw-24\b/);
  });
});
