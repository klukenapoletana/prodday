import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { hexToHsv, hsvToHex, normalizeHex, SAVED_LIMIT } from '../utils/customColors.js';
import useSavedColors from '../hooks/useSavedColors.js';

const WHEEL_PX = 232;
// The hue circle as CSS: hue runs clockwise from red at the top, saturation
// from white at the centre to full at the rim (the HSV wheel at full brightness).
const WHEEL_BG = 'radial-gradient(circle closest-side, #fff, rgba(255,255,255,0)), '
  + 'conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)';

/** A point on the wheel (relative to its centre, in px) as hue and saturation. */
export function pointToHueSat(dx, dy, radius) {
  const h = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  const s = Math.min(1, Math.hypot(dx, dy) / radius);
  return { h, s };
}

/**
 * The colour wheel: drag the point over the circle for hue and saturation, set
 * the brightness below it, or type a hex. "Save" keeps the colour among the
 * saved ones (up to SAVED_LIMIT, newest first); "Apply" gives it to the task.
 * Rendered over the task editor; its root carries `color-picker-container` so
 * the desktop colour popover it opened from stays open behind it.
 */
export default function ColorWheelModal({ initial, onApply, onClose, darkMode }) {
  const { t } = useTranslation();
  const { saved, save, remove } = useSavedColors();
  const start = normalizeHex(initial) ? hexToHsv(initial) : { h: 200, s: 0.45, v: 0.9 };
  const [hsv, setHsv] = useState(start);
  const [hexDraft, setHexDraft] = useState(hsvToHex(start.h, start.s, start.v));
  const wheelRef = useRef(null);
  const dragging = useRef(false);
  const hex = hsvToHex(hsv.h, hsv.s, hsv.v);

  useEffect(() => { setHexDraft(hex); }, [hex]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const pick = (e) => {
    const rect = wheelRef.current.getBoundingClientRect();
    const r = rect.width / 2;
    const { h, s } = pointToHueSat(e.clientX - rect.left - r, e.clientY - rect.top - r, r);
    setHsv((prev) => ({ ...prev, h, s }));
  };

  const r = WHEEL_PX / 2;
  const rad = (hsv.h * Math.PI) / 180;
  const knobX = r + r * hsv.s * Math.sin(rad);
  const knobY = r - r * hsv.s * Math.cos(rad);

  const card = darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-stone-900';
  const sub = darkMode ? 'text-gray-400' : 'text-stone-500';
  const field = darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-stone-300';
  const secondaryBtn = darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-100' : 'bg-stone-200 hover:bg-stone-300 text-stone-800';
  const isSaved = saved.includes(hex);

  return createPortal(
    <div
      className="color-picker-container fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-black/50"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      data-color-wheel
    >
      <div role="dialog" aria-modal="true" aria-label={t('colorWheel.title')}
        className={`${card} w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl`}
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{t('colorWheel.title')}</h3>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className={sub}><X size={20} /></button>
        </div>

        <div className="flex justify-center">
          <div
            ref={wheelRef}
            data-wheel
            className="relative rounded-full cursor-crosshair select-none"
            style={{ width: WHEEL_PX, height: WHEEL_PX, background: WHEEL_BG, touchAction: 'none' }}
            onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); pick(e); }}
            onPointerMove={(e) => { if (dragging.current) pick(e); }}
            onPointerUp={() => { dragging.current = false; }}
            onPointerCancel={() => { dragging.current = false; }}
          >
            {/* Brightness: the wheel darkens as the slider goes down. */}
            <div className="absolute inset-0 rounded-full bg-black pointer-events-none" style={{ opacity: 1 - hsv.v }} />
            <div
              data-wheel-knob
              className="absolute w-7 h-7 rounded-full border-[3px] border-white shadow-md pointer-events-none"
              style={{ left: knobX - 14, top: knobY - 14, backgroundColor: hex, boxShadow: '0 0 0 1px rgba(0,0,0,.35), 0 2px 6px rgba(0,0,0,.4)' }}
            />
          </div>
        </div>

        <label className={`block text-sm mt-5 mb-1 ${sub}`} htmlFor="color-wheel-brightness">{t('colorWheel.brightness')}</label>
        <input
          id="color-wheel-brightness"
          type="range" min={0} max={100} step={1}
          value={Math.round(hsv.v * 100)}
          onChange={(e) => setHsv((prev) => ({ ...prev, v: Number(e.target.value) / 100 }))}
          className="w-full h-3 rounded-full appearance-none cursor-pointer"
          style={{ background: `linear-gradient(to right, #000, ${hsvToHex(hsv.h, hsv.s, 1)})` }}
        />

        <div className="flex items-center gap-3 mt-4">
          <div className="w-11 h-11 rounded-full border border-black/10 flex-shrink-0" style={{ backgroundColor: hex }} data-preview />
          <input
            type="text"
            value={hexDraft}
            aria-label={t('colorWheel.hex')}
            onChange={(e) => {
              setHexDraft(e.target.value);
              // Only a full six-digit hex moves the wheel; "#ab" is still being typed.
              if (/^#?[0-9a-f]{6}$/i.test(e.target.value.trim())) setHsv(hexToHsv(normalizeHex(e.target.value)));
            }}
            onBlur={() => setHexDraft(hex)}
            className={`flex-1 min-w-0 px-3 py-2 border rounded-lg font-mono text-sm ${field}`}
            spellCheck={false}
            autoCapitalize="off"
          />
          <button type="button" onClick={() => save(hex)} disabled={isSaved}
            className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${secondaryBtn} disabled:opacity-50`}>
            {isSaved ? t('colorWheel.isSaved') : t('colorWheel.save')}
          </button>
        </div>

        <div className={`text-sm mt-5 mb-2 ${sub}`}>
          {t('colorWheel.saved', { count: saved.length, limit: SAVED_LIMIT })}
          {saved.length >= SAVED_LIMIT && !isSaved && <span className="block text-xs mt-0.5">{t('colorWheel.full')}</span>}
        </div>
        <div className="grid grid-cols-9 gap-2 min-h-[2rem]" data-saved-colors>
          {saved.map((c) => (
            <div key={c} className="relative">
              <button type="button" onClick={() => setHsv(hexToHsv(c))} title={c} aria-label={c}
                className={`w-full aspect-square rounded-full ${c === hex ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
                style={{ backgroundColor: c }} />
              <button type="button" onClick={() => remove(c)} aria-label={t('colorWheel.remove', { color: c })}
                className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center ${darkMode ? 'bg-gray-600 text-white' : 'bg-stone-500 text-white'}`}>
                <X size={10} strokeWidth={3} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onClose} className={`flex-1 py-2.5 rounded-lg font-medium ${secondaryBtn}`}>{t('common.cancel')}</button>
          <button type="button" onClick={() => onApply(hex)} className="flex-1 py-2.5 rounded-lg font-medium bg-blue-600 hover:bg-blue-700 text-white">{t('common.apply')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
