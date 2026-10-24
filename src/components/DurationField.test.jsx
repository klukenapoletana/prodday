import React, { useState } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import { act, create } from 'react-test-renderer';
import i18next from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { loaders } from '../locales.js';
import DurationField, { minuteOptions, hourOptions, combineDuration } from './DurationField.jsx';

// A task's duration as two scroll wheels: hours, and minutes on the
// timeline's 5-minute grid. An off-grid duration keeps its exact minute.

let i18n;
beforeAll(async () => {
  const bundle = await loaders.en();
  i18n = i18next.createInstance();
  await i18n.init({ lng: 'en', fallbackLng: false, resources: { en: { translation: bundle } }, interpolation: { escapeValue: false } });
});

// The field inside a parent that owns the task's duration, as the modals do.
function mount(initial, props = {}) {
  const reported = [];
  const Host = () => {
    const [value, setValue] = useState(initial);
    return <DurationField value={value} onChange={(m) => { reported.push(m); setValue(m); }} {...props} />;
  };
  let root;
  act(() => { root = create(<I18nextProvider i18n={i18n}><Host /></I18nextProvider>); });
  const wheels = () => root.root.findAll(n => n.props?.role === 'listbox' && typeof n.type === 'string');
  const rows = (w) => wheels()[w].findAll(n => n.props?.role === 'option' && typeof n.type === 'string');
  const selected = (w) => rows(w).find(r => r.props['aria-selected']).children.join('');
  const tap = (w, label) => act(() => { rows(w).find(r => r.children.join('') === label).props.onClick(); });
  return { reported, wheels, rows, selected, tap };
}

describe('wheel rows', () => {
  it('minutes run on the 5-minute grid', () => {
    expect(minuteOptions(0)).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
  });

  it('an off-grid minute joins the grid in order', () => {
    expect(minuteOptions(47)).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 47, 50, 55]);
  });

  it('hours run 0 to 23, plus a longer task\'s own hour', () => {
    expect(hourOptions(3)).toHaveLength(24);
    expect(hourOptions(24).at(-1)).toBe(24);
  });

  it('a duration is never zero', () => {
    expect(combineDuration(0, 0)).toBe(5);
    expect(combineDuration(1, 50)).toBe(110);
  });
});

describe('DurationField', () => {
  it('shows a duration as hours and two-digit minutes', () => {
    const { selected } = mount(110);
    expect(selected(0)).toBe('1');
    expect(selected(1)).toBe('50');
  });

  it('labels each wheel for assistive tech', () => {
    const { wheels } = mount(30);
    expect(wheels().map(w => w.props['aria-label'])).toEqual(['Duration: h', 'Duration: min']);
  });

  it('reports the combined duration when a minute is chosen', () => {
    const { tap, reported, selected } = mount(60);
    tap(1, '25');
    expect(reported).toEqual([85]);
    expect(selected(1)).toBe('25');
  });

  it('keeps the minutes when the hours change', () => {
    const { tap, reported } = mount(45);
    tap(0, '2');
    expect(reported).toEqual([165]);
  });

  it('turns 0 h 0 min into the shortest step', () => {
    const { tap, reported } = mount(5);
    tap(1, '00');
    expect(reported).toEqual([5]);
  });

  it('shows an off-grid duration exactly, without rounding it', () => {
    const { selected, rows, reported } = mount(47);
    expect(selected(1)).toBe('47');
    expect(rows(1).map(r => r.children.join(''))).toContain('45');
    expect(reported).toEqual([]);
  });

  it('treats a duration stored as text like the number it is', () => {
    const { selected } = mount('90');
    expect(selected(0)).toBe('1');
    expect(selected(1)).toBe('30');
  });

  it('takes the wheels out of the tab order when disabled', () => {
    const { wheels } = mount(30, { disabled: true });
    expect(wheels().every(w => w.props.tabIndex === -1)).toBe(true);
  });
});
