import React, { useCallback, useEffect, useRef } from 'react';

export const ITEM_PX = 40;
const VISIBLE = 5; // rows on screen; odd, so one sits in the middle

/**
 * One scroll wheel, the way a phone's native picker works: a column of values
 * that scrolls and snaps, the middle row being the choice. Built on CSS scroll
 * snap, so a flick coasts and settles on a row by itself; the choice is read
 * once scrolling ends. A tap on a row scrolls it to the middle, and the arrow
 * keys step it when the wheel has focus.
 *
 * The wheel follows `value` (scrolling without reporting) and reports only a
 * change the user made, so a parent that rewrites the value (a clamp) never
 * hears its own write back.
 *
 * @param {{ options: number[], value: number, onChange: (v: number) => void,
 *   format?: (v: number) => string, label: string, disabled?: boolean,
 *   darkMode?: boolean }} props
 */
export default function WheelPicker({ options, value, onChange, format = String, label, disabled = false, darkMode = false }) {
  const ref = useRef(null);
  const settleTimer = useRef(null);
  const programmatic = useRef(false);
  const index = Math.max(0, options.indexOf(value));

  const scrollToIndex = useCallback((i, smooth) => {
    const el = ref.current;
    if (!el) return;
    programmatic.current = !smooth;
    if (typeof el.scrollTo === 'function') el.scrollTo({ top: i * ITEM_PX, behavior: smooth ? 'smooth' : 'auto' });
    else el.scrollTop = i * ITEM_PX;
  }, []);

  // Follow the value, and the list when it changes length (an off-grid row).
  useEffect(() => {
    const el = ref.current;
    if (el && Math.round(el.scrollTop / ITEM_PX) !== index) scrollToIndex(index, false);
  }, [index, options.length, scrollToIndex]);

  const settle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (programmatic.current) { programmatic.current = false; return; }
    const i = Math.min(options.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_PX)));
    if (options[i] !== value) onChange(options[i]);
  }, [options, value, onChange]);

  const onScroll = () => {
    clearTimeout(settleTimer.current);
    // scrollend where the engine has it; a short quiet period everywhere else.
    settleTimer.current = setTimeout(settle, 140);
  };
  useEffect(() => () => clearTimeout(settleTimer.current), []);

  const step = (delta) => {
    const i = Math.min(options.length - 1, Math.max(0, index + delta));
    if (i !== index) { onChange(options[i]); scrollToIndex(i, true); }
  };

  const band = darkMode ? 'bg-gray-700' : 'bg-stone-200';
  const text = darkMode ? 'text-gray-100' : 'text-stone-900';
  const pad = ITEM_PX * ((VISIBLE - 1) / 2);

  return (
    <div className={`relative ${disabled ? 'opacity-50 pointer-events-none' : ''}`} style={{ height: ITEM_PX * VISIBLE }}>
      <div className={`absolute inset-x-0 rounded-lg ${band}`} style={{ top: pad, height: ITEM_PX }} aria-hidden="true" />
      <div
        ref={ref}
        role="listbox"
        aria-label={label}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        onScroll={onScroll}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') { e.preventDefault(); step(-1); }
          if (e.key === 'ArrowDown') { e.preventDefault(); step(1); }
        }}
        data-wheel-picker
        className={`relative h-full overflow-y-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg ${text}`}
        style={{
          scrollSnapType: 'y mandatory',
          overscrollBehavior: 'contain',
          scrollbarWidth: 'none',
          paddingTop: pad,
          paddingBottom: pad,
          maskImage: 'linear-gradient(to bottom, transparent, #000 35%, #000 65%, transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 35%, #000 65%, transparent)',
        }}
      >
        {options.map((opt, i) => (
          <div
            key={opt}
            role="option"
            aria-selected={i === index}
            onClick={() => { if (i !== index) { onChange(opt); scrollToIndex(i, true); } }}
            className={`flex items-center justify-center tabular-nums select-none cursor-pointer ${i === index ? 'text-xl font-semibold' : 'text-lg opacity-70'}`}
            style={{ height: ITEM_PX, scrollSnapAlign: 'center' }}
          >
            {format(opt)}
          </div>
        ))}
      </div>
    </div>
  );
}
