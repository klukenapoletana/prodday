import { describe, it, expect } from 'vitest';
import {
  normalizeHex, isCustomColor, hsvToHex, hexToHsv, wantsDarkText, customColorCss,
  readSavedColors, withSavedColor, withoutSavedColor, SAVED_COLORS_KEY, SAVED_LIMIT,
} from './customColors.js';
import { collectCustomColors } from '../components/CustomColorStyles.jsx';
import { pointToHueSat } from '../components/ColorWheelModal.jsx';
import { taskColorToHex } from './colorUtils.js';

// Free task colours from the colour wheel: stored as "#rrggbb", drawn through
// generated class rules, up to nine kept for later.

describe('hex handling', () => {
  it('normalizes short, bare and mixed-case hex, and rejects the rest', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
    expect(normalizeHex(' 7AB3E0 ')).toBe('#7ab3e0');
    for (const bad of ['', '#12', '#12345', 'blue', 'bg-blue-500', null, undefined]) expect(normalizeHex(bad)).toBe(null);
  });

  it('tells a free colour from a preset class', () => {
    expect(isCustomColor('#7ab3e0')).toBe(true);
    expect(isCustomColor('bg-blue-500')).toBe(false);
    expect(isCustomColor('bg-pastel-rose')).toBe(false);
    expect(isCustomColor('#ABC')).toBe(false); // stored colours are always normalized
  });

  it('passes through to the widgets and the Day Dial unchanged', () => {
    expect(taskColorToHex('#7ab3e0')).toBe('#7ab3e0');
  });
});

describe('HSV', () => {
  it('maps the wheel\'s landmarks', () => {
    expect(hsvToHex(0, 1, 1)).toBe('#ff0000');
    expect(hsvToHex(120, 1, 1)).toBe('#00ff00');
    expect(hsvToHex(240, 1, 1)).toBe('#0000ff');
    expect(hsvToHex(0, 0, 1)).toBe('#ffffff');
    expect(hsvToHex(200, 0.5, 0)).toBe('#000000');
  });

  it('round-trips every 8-bit colour it is given', () => {
    for (const hex of ['#7ab3e0', '#f7c5cf', '#123456', '#fe8b00', '#808080', '#010203', '#ffffff', '#000000']) {
      const { h, s, v } = hexToHsv(hex);
      expect(hsvToHex(h, s, v)).toBe(hex);
    }
  });
});

describe('text on a free colour', () => {
  it('is dark on light fills and stays white on dark ones', () => {
    expect(wantsDarkText('#ffffff')).toBe(true);
    expect(wantsDarkText('#f7c5cf')).toBe(true); // pastel rose
    expect(wantsDarkText('#ffeb3b')).toBe(true); // yellow
    expect(wantsDarkText('#000000')).toBe(false);
    expect(wantsDarkText('#1d4ed8')).toBe(false); // deep blue
    expect(wantsDarkText('#7c3aed')).toBe(false); // violet
  });

  it('fills each colour once, with the ink the scoped rule reads', () => {
    const css = customColorCss(['#f7c5cf', '#1d4ed8', '#f7c5cf', 'bg-blue-500']);
    expect(css).toBe(
      '.\\#f7c5cf{background-color:#f7c5cf;--fill-ink:31 41 55}\n'
      + '.\\#1d4ed8{background-color:#1d4ed8;--fill-ink:255 255 255}\n',
    );
    expect(customColorCss([])).toBe('');
  });
});

describe('collecting the colours in use', () => {
  it('takes the user\'s own tasks, series overrides and saved colours, never calendar imports', () => {
    const colors = collectCustomColors([
      [{ color: '#111111' }, { color: 'bg-blue-500' }, { color: '#222222', imported: true }],
      [{ color: '#333333' }],
      [{ color: 'bg-red-500', exceptions: { '2026-10-25': { color: '#444444' }, '2026-10-26': { deleted: true } } }],
    ], ['#555555', '#111111']);
    expect(colors).toEqual(['#111111', '#333333', '#444444', '#555555']);
  });
});

describe('the wheel', () => {
  it('reads hue clockwise from the top and saturation from the centre', () => {
    expect(pointToHueSat(0, -100, 100)).toEqual({ h: 0, s: 1 });
    expect(pointToHueSat(100, 0, 100).h).toBeCloseTo(90);
    expect(pointToHueSat(0, 50, 100)).toEqual({ h: 180, s: 0.5 });
    expect(pointToHueSat(-100, 0, 100).h).toBeCloseTo(270);
    expect(pointToHueSat(0, 0, 100).s).toBe(0);
    expect(pointToHueSat(300, 0, 100).s).toBe(1); // past the rim clamps
  });
});

describe('saved colours', () => {
  const store = (value) => ({ getItem: (k) => (k === SAVED_COLORS_KEY ? value : null) });

  it('reads a clean, deduplicated list of at most nine', () => {
    const many = JSON.stringify(['#ABC', '#aabbcc', 'nope', ...Array.from({ length: 12 }, (_, i) => `#0000${String(i).padStart(2, '0')}`)]);
    const list = readSavedColors(store(many));
    expect(list[0]).toBe('#aabbcc');
    expect(list).toHaveLength(SAVED_LIMIT);
    expect(new Set(list).size).toBe(list.length);
    expect(readSavedColors(store('{broken'))).toEqual([]);
    expect(readSavedColors(store(null))).toEqual([]);
  });

  it('saves newest first, moves a repeat to the front and drops the oldest past nine', () => {
    let list = [];
    for (let i = 1; i <= 9; i += 1) list = withSavedColor(list, `#00000${i}`);
    expect(list[0]).toBe('#000009');
    list = withSavedColor(list, '#000005');
    expect(list[0]).toBe('#000005');
    expect(list).toHaveLength(9);
    list = withSavedColor(list, '#ffffff');
    expect(list).toHaveLength(9);
    expect(list).not.toContain('#000001');
    expect(withSavedColor(list, 'bogus')).toBe(list);
  });

  it('removes one colour', () => {
    expect(withoutSavedColor(['#111111', '#222222'], '#111111')).toEqual(['#222222']);
  });
});
