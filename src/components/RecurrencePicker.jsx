import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDayPlannerCtx } from '../context/DayPlannerContext.jsx';
import { dateToString } from '../utils/taskUtils.js';
import {
  getRecurrencePresets,
  getSelectedWeekdays,
  toggleRecurrenceDay,
  setRecurrenceFrequency,
  setRecurrenceInterval,
  recurrenceUnitAndInterval,
  weekdayOrder,
  MAX_INTERVAL,
} from '../utils/recurrenceEngine.js';

const INTERVAL_UNITS = [
  ['daily', 'recurrence.unitDays'],
  ['weekly', 'recurrence.unitWeeks'],
  ['monthly', 'recurrence.unitMonths'],
  ['yearly', 'recurrence.unitYears'],
];

/**
 * The Repeat dropdown, shared by the mobile and desktop task editors — the two
 * carried near-identical copies, and the day grid below would have been a
 * third and fourth.
 *
 * Presets on top, then a day grid for the case they can't express: "every week
 * on Mon, Wed and Fri". The engine has always read recurrence.daysOfWeek as a
 * set (as have the labels, the quick-add parser and ICS import) — only the
 * picker could not produce more than one, so this is a UI gap, not a new
 * recurrence kind.
 *
 * The grid is not a separate "custom" mode: it reflects whatever is selected,
 * so picking "Every weekday" lights Mon-Fri and tapping Saturday extends it.
 *
 * `placement` puts the popover above (mobile, where the field sits low in a
 * sheet) or below (desktop) the trigger.
 */
const RecurrencePicker = ({ placement = 'bottom', highlightSelected = false }) => {
  const { t, i18n } = useTranslation();
  const {
    newTask, setNewTask, selectedDate, weekStartDay = 0,
    setShowRecurrencePicker,
    darkMode, cardBg, borderClass, textPrimary, textSecondary,
  } = useDayPlannerCtx();

  const dateStr = newTask.date || dateToString(selectedDate);
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  const presets = getRecurrencePresets(dateStr, t, locale);
  const recurrence = newTask.recurrence;
  const selectedDays = getSelectedWeekdays(recurrence, dateStr);
  const isWeekly = recurrence?.type === 'weekly' || recurrence?.type === 'biweekly';

  // Narrow weekday initials in the user's own language, so the row reads
  // M T W T F S S / L M M J V S D without shipping seven more strings.
  const dayInitial = (dow) =>
    new Date(Date.UTC(2024, 0, 7 + dow)).toLocaleDateString(locale, { weekday: 'narrow', timeZone: 'UTC' });
  const dayFull = (dow) =>
    new Date(Date.UTC(2024, 0, 7 + dow)).toLocaleDateString(locale, { weekday: 'long', timeZone: 'UTC' });

  // End conditions are set outside this popover and must survive a change of
  // pattern — picking a different preset should not silently clear "until Dec 1".
  const endFields = () => {
    const fields = {};
    if (recurrence?.endDate) fields.endDate = recurrence.endDate;
    if (recurrence?.maxOccurrences) fields.maxOccurrences = recurrence.maxOccurrences;
    return fields;
  };

  const applyPreset = (preset) => {
    setNewTask({ ...newTask, recurrence: preset.value ? { ...preset.value, ...endFields() } : null });
    setShowRecurrencePicker(false);
  };

  // The grid stays open across taps: choosing three days is three taps, and
  // closing after the first would make the multi-day case unreachable.
  const applyDay = (dow) =>
    setNewTask({ ...newTask, recurrence: { ...toggleRecurrenceDay(recurrence, dow, dateStr), ...endFields() } });

  // The week buttons mean every 1 and every 2 weeks, so they drop an interval.
  const applyFrequency = (type) => {
    const { interval: _interval, ...next } = setRecurrenceFrequency(recurrence, type, dateStr);
    setNewTask({ ...newTask, recurrence: { ...next, ...endFields() } });
  };

  // "Repeat every [n] [unit]" (utils/recurrenceEngine.js setRecurrenceInterval).
  // It reflects the selection like the day grid does; with no repeat chosen
  // it shows "every 1 day" and choosing anything there starts one. The count
  // is typed as text and applied once it is a whole number in range, so
  // clearing the field to type "12" does not reset the series on the way.
  const current = recurrenceUnitAndInterval(recurrence);
  const unit = current?.unit ?? 'daily';
  const count = current?.n ?? 1;
  const [countDraft, setCountDraft] = useState(String(count));
  useEffect(() => { setCountDraft(String(count)); }, [count]);
  const applyInterval = (nextUnit, nextCount) =>
    setNewTask({ ...newTask, recurrence: { ...setRecurrenceInterval(recurrence, nextUnit, nextCount, dateStr), ...endFields() } });

  const freqButton = (type, label) => (
    <button
      type="button"
      onClick={() => applyFrequency(type)}
      className={`flex-1 px-2 py-1 text-xs rounded-md border ${borderClass} transition-colors ${
        recurrence?.type === type
          ? 'bg-blue-600 text-white border-blue-600'
          : `${darkMode ? 'bg-gray-700 text-gray-200' : 'bg-white'} ${textPrimary}`
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      className={`absolute ${placement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} left-0 ${cardBg} rounded-lg shadow-xl z-30 border ${borderClass} min-w-[250px] max-h-[380px] flex flex-col`}
    >
      {/* Only the presets scroll. The day grid is pinned below them: it is the
          part people will not think to look for, and eight presets are enough
          to push it under the fold. */}
      <div className="overflow-y-auto">
      {presets.map((preset, i) => (
        <button
          key={i}
          type="button"
          onClick={() => applyPreset(preset)}
          className={`w-full text-left px-3 py-2 text-sm ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-stone-100'} ${
            highlightSelected && JSON.stringify(recurrence) === JSON.stringify(preset.value)
              ? (darkMode ? 'bg-gray-700' : 'bg-blue-50 text-blue-700')
              : textPrimary
          } ${i === 0 ? 'rounded-t-lg' : ''}`}
        >
          {preset.label}
        </button>
      ))}
      </div>

      <div className={`border-t ${borderClass} px-3 py-2 flex-shrink-0`}>
        <span className={`block text-xs font-medium ${textSecondary} mb-1.5`}>{t('task.repeatOn')}</span>
        <div className="flex gap-1">
          {weekdayOrder(weekStartDay).map((dow) => {
            const active = selectedDays.includes(dow);
            return (
              <button
                key={dow}
                type="button"
                onClick={() => applyDay(dow)}
                aria-pressed={active}
                aria-label={dayFull(dow)}
                className={`w-7 h-7 rounded-md text-xs font-semibold transition-colors flex-shrink-0 border ${
                  active
                    ? 'bg-blue-600 text-white border-blue-600'
                    : `${borderClass} ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-white'} ${textSecondary}`
                }`}
              >
                {dayInitial(dow)}
              </button>
            );
          })}
        </div>
        {isWeekly && (
          <div className="flex gap-1 mt-1.5">
            {freqButton('weekly', t('task.everyWeek'))}
            {freqButton('biweekly', t('task.every2Weeks'))}
          </div>
        )}
      </div>

      <div className={`border-t ${borderClass} px-3 py-2 flex-shrink-0`} data-recurrence-interval>
        <label className={`block text-xs font-medium ${textSecondary} mb-1.5`} htmlFor="recurrence-interval-count">
          {t('recurrence.intervalLabel')}
        </label>
        <div className="flex gap-2">
          <input
            id="recurrence-interval-count"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_INTERVAL}
            step={1}
            value={countDraft}
            onChange={(e) => {
              setCountDraft(e.target.value);
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= 1 && n <= MAX_INTERVAL) applyInterval(unit, n);
            }}
            onBlur={() => setCountDraft(String(count))}
            className={`w-16 px-2 py-1 text-sm border ${borderClass} rounded-md ${darkMode ? 'bg-gray-700 text-white' : 'bg-white'}`}
          />
          <select
            value={current ? unit : ''}
            onChange={(e) => applyInterval(e.target.value, count)}
            aria-label={t('recurrence.intervalLabel')}
            className={`flex-1 min-w-0 px-2 py-1 text-sm border ${borderClass} rounded-md ${darkMode ? 'bg-gray-700 text-white' : 'bg-white'}`}
          >
            {!current && <option value="" disabled>—</option>}
            {INTERVAL_UNITS.map(([value, key]) => (
              <option key={value} value={value}>{t(key, { count })}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default RecurrencePicker;
