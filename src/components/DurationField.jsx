import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDuration } from '../utils/formatDuration.js';

export const MIN_DURATION = 1;
export const MAX_DURATION = 24 * 60;
const CUSTOM = 'custom';

/** A typed duration as whole minutes within the allowed range, or null. */
export const parseDurationInput = (raw) => {
  const n = Number(String(raw ?? '').trim());
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n < MIN_DURATION || n > MAX_DURATION) return null;
  return n;
};

/**
 * A task's duration: the presets as a select, plus "Other duration…", which
 * opens a minutes field for any whole number of minutes. A value that is not a
 * preset (typed here, resized on the timeline, imported) opens on the field,
 * so the select never claims a duration the task does not have.
 *
 * The field keeps what is typed as text and reports only valid minutes, so a
 * half-typed or cleared field never writes NaN into the task; leaving it
 * restores the last valid value.
 */
export default function DurationField({ value, onChange, options, disabled = false, className = '' }) {
  const { t } = useTranslation();
  const current = Number(value);
  const isPreset = options.includes(current);
  const [customOpen, setCustomOpen] = useState(!isPreset);
  const [draft, setDraft] = useState(String(value ?? ''));

  useEffect(() => { setDraft(String(value ?? '')); }, [value]);
  useEffect(() => { if (!isPreset) setCustomOpen(true); }, [isPreset]);

  const showCustom = customOpen || !isPreset;
  const minutes = parseDurationInput(draft);

  return (
    <div className="space-y-2">
      <select
        value={showCustom ? CUSTOM : current}
        onChange={(e) => {
          if (e.target.value === CUSTOM) { setCustomOpen(true); return; }
          setCustomOpen(false);
          onChange(parseInt(e.target.value, 10));
        }}
        disabled={disabled}
        className={className}
      >
        {options.map(m => (
          <option key={m} value={m}>{t('common.minutesShort', { count: m })}</option>
        ))}
        <option value={CUSTOM}>{t('task.customDuration')}</option>
      </select>
      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={MIN_DURATION}
            max={MAX_DURATION}
            step={1}
            value={draft}
            disabled={disabled}
            aria-label={t('task.durationInMinutes')}
            onChange={(e) => {
              setDraft(e.target.value);
              const next = parseDurationInput(e.target.value);
              if (next !== null) onChange(next);
            }}
            onBlur={() => setDraft(String(value ?? ''))}
            className={`${className.replace(/\bw-full\b/, '')} w-24`}
          />
          <span className="text-sm opacity-70">
            {t('task.minutesUnit')}{minutes !== null && minutes >= 60 ? ` (${formatDuration(minutes, t)})` : ''}
          </span>
        </div>
      )}
    </div>
  );
}
