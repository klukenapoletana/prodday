// Free task colours (the colour wheel, components/ColorWheelModal.jsx). A task's
// `color` is a Tailwind class for the presets (utils/colorUtils.js) and a
// "#rrggbb" string for a colour picked on the wheel. Every card draws
// `className={task.color}`, so a hex is drawn the same way: a class token
// "#rrggbb" that a rule generated here (customColorCss, mounted by
// CustomColorStyles) fills. taskColorToHex already passes a hex through, so
// the widgets and the Day Dial need nothing.
//
// Up to SAVED_LIMIT colours are kept for later, newest first, on this device.

export const SAVED_COLORS_KEY = 'day-planner-custom-colors';
export const SAVED_LIMIT = 9;

const HEX = /^#[0-9a-f]{6}$/;

/** "#ABC", "abc123", " #AbC123 " → "#aabbcc" / "#abc123"; anything else → null. */
export function normalizeHex(raw) {
  let s = String(raw ?? '').trim().toLowerCase();
  if (!s.startsWith('#')) s = `#${s}`;
  if (/^#[0-9a-f]{3}$/.test(s)) s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  return HEX.test(s) ? s : null;
}

/** Whether a task colour is a free hex colour rather than a preset class. */
export const isCustomColor = (color) => typeof color === 'string' && HEX.test(color);

const clamp01 = (n) => Math.min(1, Math.max(0, n));

/** h in degrees [0, 360), s and v in [0, 1] → "#rrggbb". */
export function hsvToHex(h, s, v) {
  const hh = ((h % 360) + 360) % 360;
  const ss = clamp01(s);
  const vv = clamp01(v);
  const f = (n) => {
    const k = (n + hh / 60) % 6;
    return vv - vv * ss * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const to = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to(f(5))}${to(f(3))}${to(f(1))}`;
}

/** "#rrggbb" → { h, s, v }; a gray keeps hue 0. */
export function hexToHsv(hex) {
  const n = normalizeHex(hex);
  if (!n) return { h: 0, s: 0, v: 0 };
  const r = parseInt(n.slice(1, 3), 16) / 255;
  const g = parseInt(n.slice(3, 5), 16) / 255;
  const b = parseInt(n.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d > 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return { h: (h + 360) % 360, s: max === 0 ? 0 : d / max, v: max };
}

/** WCAG relative luminance of "#rrggbb", 0 (black) to 1 (white). */
export function luminance(hex) {
  const n = normalizeHex(hex);
  if (!n) return 0;
  const lin = (i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5);
}

// The dark ink light fills get (index.css, "Pastel task colours"): gray-800.
const INK_LUMINANCE = luminance('#1f2937');
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Whether a fill reads better with dark text than with the cards' white text. */
export function wantsDarkText(hex) {
  const l = luminance(hex);
  return contrast(l, INK_LUMINANCE) > contrast(l, 1);
}

/**
 * The stylesheet for a set of free colours: each one fills the elements that
 * carry it as a class, and tells the scoped text rule in index.css which ink to
 * use on it (dark on a light fill, the cards' own white on a dark one).
 */
export function customColorCss(colors) {
  const seen = new Set();
  let css = '';
  for (const c of colors) {
    const hex = normalizeHex(c);
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);
    const ink = wantsDarkText(hex) ? '31 41 55' : '255 255 255';
    css += `.\\${hex}{background-color:${hex};--fill-ink:${ink}}\n`;
  }
  return css;
}

/** The saved colours, newest first; an unreadable store is none. */
export function readSavedColors(storage = globalThis.localStorage) {
  try {
    const list = JSON.parse(storage?.getItem(SAVED_COLORS_KEY) || '[]');
    if (!Array.isArray(list)) return [];
    const out = [];
    for (const c of list) {
      const hex = normalizeHex(c);
      if (hex && !out.includes(hex)) out.push(hex);
    }
    return out.slice(0, SAVED_LIMIT);
  } catch {
    return [];
  }
}

/** `hex` saved first; a colour already saved moves to the front, the oldest drops past the limit. */
export const withSavedColor = (list, hex) => {
  const n = normalizeHex(hex);
  if (!n) return list;
  return [n, ...list.filter((c) => c !== n)].slice(0, SAVED_LIMIT);
};

export const withoutSavedColor = (list, hex) => list.filter((c) => c !== normalizeHex(hex));
