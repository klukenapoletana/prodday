import React from 'react';
import { useTranslation } from 'react-i18next';
import WheelPicker from './WheelPicker.jsx';
import { SNAP_MINUTES } from '../utils/dragUtils.js';

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const GRID_MINUTES = Array.from({ length: 60 / SNAP_MINUTES }, (_, i) => i * SNAP_MINUTES);

/** The minutes wheel's rows: the timeline grid, plus the task's own minute if it sits off it. */
export const minuteOptions = (minute) =>
  (GRID_MINUTES.includes(minute) ? GRID_MINUTES : [...GRID_MINUTES, minute].sort((a, b) => a - b));

/** The hours wheel's rows: 0 to 23, plus the task's own hour if it is longer than that. */
export const hourOptions = (hour) => (HOURS.includes(hour) ? HOURS : [...HOURS, hour]);

/** A duration from the two wheels; never zero, a zero becoming one grid step. */
export const combineDuration = (hours, minutes) => Math.max(SNAP_MINUTES, hours * 60 + minutes);

/**
 * A task's duration as two scroll wheels, hours and minutes, like the phone's
 * own time pickers. Minutes step on the timeline's grid (SNAP_MINUTES); a
 * duration that sits off it (resized elsewhere, imported) keeps its exact
 * minute as an extra row, so opening a task never rounds what it has.
 */
export default function DurationField({ value, onChange, disabled = false, darkMode = false }) {
  const { t } = useTranslation();
  const total = Math.max(0, Math.round(Number(value) || 0));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const unit = `text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`;
  const pad = (n) => String(n).padStart(2, '0');

  return (
    <div className="flex items-center gap-2" data-duration-field>
      <div className="flex-1 min-w-0">
        <WheelPicker
          options={hourOptions(hours)}
          value={hours}
          onChange={(h) => onChange(combineDuration(h, minutes))}
          label={`${t('task.duration')}: ${t('task.hoursUnit')}`}
          disabled={disabled}
          darkMode={darkMode}
        />
      </div>
      <span className={unit}>{t('task.hoursUnit')}</span>
      <div className="flex-1 min-w-0">
        <WheelPicker
          options={minuteOptions(minutes)}
          value={minutes}
          onChange={(m) => onChange(combineDuration(hours, m))}
          format={pad}
          label={`${t('task.duration')}: ${t('task.minutesUnit')}`}
          disabled={disabled}
          darkMode={darkMode}
        />
      </div>
      <span className={unit}>{t('task.minutesUnit')}</span>
    </div>
  );
}
