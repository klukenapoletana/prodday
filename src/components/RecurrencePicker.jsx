import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Plus } from 'lucide-react';
import { useDayPlannerCtx } from '../context/DayPlannerContext.jsx';
import { dateToString } from '../utils/taskUtils.js';
import {
  getSelectedWeekdays,
  toggleRecurrenceDay,
  setRecurrenceInterval,
  setRecurrenceAnchor,
  isCompletionAnchored,
  recurrenceUnitAndInterval,
  weekdayOrder,
  MAX_INTERVAL,
} from '../utils/recurrenceEngine.js';

const UNITS = [
  ['daily', 'recurrence.unitDays'],
  ['weekly', 'recurrence.unitWeeks'],
  ['monthly', 'recurrence.unitMonths'],
  ['yearly', 'recurrence.unitYears'],
];

// The simple choices, each relative to the task's own date: weekly on its
// weekday, monthly on its day of the month.
const simpleRecurrence = (kind, dateStr) => {
  const d = new Date(dateStr + 'T12:00:00');
  if (kind === 'daily') return { type: 'daily' };
  if (kind === 'weekly') return { type: 'weekly', daysOfWeek: [d.getDay()] };
  if (kind === 'monthly') return { type: 'monthly', monthDay: d.getDate(), monthWeekday: null };
  if (kind === 'yearly') return { type: 'yearly' };
  return null;
};

/**
 * Which simple choice `rec` is, or 'custom' when it is anything those cannot
 * express (an interval, several weekdays, another day than the task's own,
 * after completion).
 */
export const recurrenceKind = (rec, dateStr) => {
  if (!rec) return 'none';
  if (isCompletionAnchored(rec)) return 'custom';
  const current = recurrenceUnitAndInterval(rec);
  if (!current || current.n !== 1) return 'custom';
  const simple = simpleRecurrence(current.unit, dateStr);
  if (rec.type === 'weekly') {
    const days = getSelectedWeekdays(rec, dateStr);
    return days.length === 1 && days[0] === simple.daysOfWeek[0] ? 'weekly' : 'custom';
  }
  if (rec.type === 'monthly') {
    if (rec.monthWeekday) return 'custom';
    return !rec.monthDay || rec.monthDay === simple.monthDay ? 'monthly' : 'custom';
  }
  return current.unit;
};

/**
 * The Repeat panel, shared by the mobile and desktop task editors. It opens in
 * place under the Repeat field: six choices (never, daily, weekly, monthly,
 * yearly, custom), and under Custom the full pattern: every [n] [unit], the
 * weekdays for weeks, the day or the weekday of the month for months, and the
 * rhythm (fixed, or counted from each completion; recurrence.js
 * getPendingOccurrence). The end condition stays in the editor below it.
 */
const RecurrencePicker = () => {
  const { t, i18n } = useTranslation();
  const {
    newTask, setNewTask, selectedDate, weekStartDay = 0,
    darkMode, borderClass, textPrimary, textSecondary,
  } = useDayPlannerCtx();

  const dateStr = newTask.date || dateToString(selectedDate);
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  const recurrence = newTask.recurrence;
  const kind = recurrenceKind(recurrence, dateStr);
  const [customOpen, setCustomOpen] = useState(kind === 'custom');
  const showCustom = customOpen || kind === 'custom';

  const taskDate = new Date(dateStr + 'T12:00:00');
  const dayInitial = (dow) =>
    new Date(Date.UTC(2024, 0, 7 + dow)).toLocaleDateString(locale, { weekday: 'narrow', timeZone: 'UTC' });
  const dayFull = (dow) =>
    new Date(Date.UTC(2024, 0, 7 + dow)).toLocaleDateString(locale, { weekday: 'long', timeZone: 'UTC' });

  // End conditions are set below the panel and survive a change of pattern.
  const endFields = () => {
    const fields = {};
    if (recurrence?.endDate) fields.endDate = recurrence.endDate;
    if (recurrence?.maxOccurrences) fields.maxOccurrences = recurrence.maxOccurrences;
    return fields;
  };
  const setRecurrence = (next) =>
    setNewTask({ ...newTask, recurrence: next ? { ...next, ...endFields() } : null });

  const chooseSimple = (choice) => {
    setCustomOpen(false);
    setRecurrence(simpleRecurrence(choice, dateStr));
  };
  const chooseCustom = () => {
    setCustomOpen(true);
    if (!recurrence) setRecurrence(simpleRecurrence('weekly', dateStr));
  };

  const current = recurrenceUnitAndInterval(recurrence);
  const unit = current?.unit ?? 'weekly';
  const count = current?.n ?? 1;
  const afterCompletion = isCompletionAnchored(recurrence);
  const applyInterval = (nextUnit, nextCount) =>
    setRecurrence(setRecurrenceInterval(recurrence, nextUnit, nextCount, dateStr));

  // The count is typed as text and applied once it is a whole number in range,
  // so clearing the field to type "12" does not reset the series on the way.
  const [countDraft, setCountDraft] = useState(String(count));
  useEffect(() => { setCountDraft(String(count)); }, [count]);

  const selectedDays = getSelectedWeekdays(recurrence, dateStr);
  const monthDay = taskDate.getDate();
  const monthWeekday = { week: Math.ceil(monthDay / 7), day: taskDate.getDay() };
  // The ordinal keys exist only in their plural forms (_ordinal_one, …).
  const ordinalOf = (key, count) => t(key, { count, ordinal: true });
  const setMonthMode = (byWeekday) => setRecurrence({
    ...recurrence,
    monthDay: byWeekday ? null : (recurrence.monthDay || monthDay),
    monthWeekday: byWeekday ? monthWeekday : null,
  });

  const idle = `${darkMode ? 'bg-gray-700 text-gray-200' : 'bg-white'} ${textPrimary}`;
  const chip = (active, onClick, label, attrs = {}) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      {...attrs}
      className={`min-w-0 px-1 py-1.5 text-[13px] sm:text-sm rounded-lg border transition-colors truncate ${
        active ? 'bg-blue-600 text-white border-blue-600' : `${borderClass} ${idle}`
      }`}
    >
      {label}
    </button>
  );
  const heading = (text, htmlFor) => (
    <label htmlFor={htmlFor} className={`block text-xs font-medium ${textSecondary} mt-3 mb-1.5`}>{text}</label>
  );
  const stepButton = (delta, Icon, label) => (
    <button
      type="button"
      onClick={() => applyInterval(unit, Math.min(MAX_INTERVAL, Math.max(1, count + delta)))}
      disabled={delta < 0 ? count <= 1 : count >= MAX_INTERVAL}
      aria-label={label}
      className={`w-9 h-9 flex items-center justify-center rounded-full border ${borderClass} ${textPrimary} disabled:opacity-40`}
    >
      <Icon size={16} />
    </button>
  );

  return (
    <div className={`mt-2 p-2.5 rounded-lg border ${borderClass} ${darkMode ? 'bg-gray-800' : 'bg-stone-50'}`} data-recurrence-panel>
      <div className="grid grid-cols-[1fr_1fr_1.45fr] gap-1.5 sm:gap-2">
        {chip(kind === 'none' && !customOpen, () => chooseSimple(null), t('common.never'), { 'data-recurrence-kind': 'none' })}
        {chip(kind === 'daily' && !customOpen, () => chooseSimple('daily'), t('recurrence.daily'), { 'data-recurrence-kind': 'daily' })}
        {chip(kind === 'weekly' && !customOpen, () => chooseSimple('weekly'), t('recurrence.weekly'), { 'data-recurrence-kind': 'weekly' })}
        {chip(kind === 'monthly' && !customOpen, () => chooseSimple('monthly'), t('recurrence.monthly'), { 'data-recurrence-kind': 'monthly' })}
        {chip(kind === 'yearly' && !customOpen, () => chooseSimple('yearly'), t('recurrence.yearly'), { 'data-recurrence-kind': 'yearly' })}
        {chip(showCustom, chooseCustom, t('recurrence.custom'), { 'data-recurrence-kind': 'custom' })}
      </div>

      {showCustom && recurrence && (
        <div data-recurrence-custom>
          {heading(t('recurrence.intervalLabel'), 'recurrence-interval-count')}
          <div className="flex items-center gap-2">
            {stepButton(-1, Minus, '−')}
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
              className={`w-12 py-1 text-center text-base bg-transparent ${textPrimary} focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none`}
            />
            {stepButton(1, Plus, '+')}
          </div>
          <div className="grid grid-cols-4 gap-2 mt-2">
            {UNITS.map(([value, key]) => (
              <React.Fragment key={value}>
                {chip(unit === value, () => applyInterval(value, count), t(key, { count }), { 'data-recurrence-unit': value })}
              </React.Fragment>
            ))}
          </div>

          {unit === 'weekly' && !afterCompletion && (
            <>
              {heading(t('recurrence.onDays'))}
              <div className="flex justify-between gap-1">
                {weekdayOrder(weekStartDay).map((dow) => {
                  const active = selectedDays.includes(dow);
                  return (
                    <button
                      key={dow}
                      type="button"
                      onClick={() => setRecurrence(toggleRecurrenceDay(recurrence, dow, dateStr))}
                      aria-pressed={active}
                      aria-label={dayFull(dow)}
                      className={`w-9 h-9 rounded-full text-sm font-semibold transition-colors flex-shrink-0 border ${
                        active ? 'bg-blue-600 text-white border-blue-600' : `${borderClass} ${idle}`
                      }`}
                    >
                      {dayInitial(dow)}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {unit === 'monthly' && !afterCompletion && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {chip(!recurrence.monthWeekday, () => setMonthMode(false),
                t('recurrence.onMonthDay', { day: ordinalOf('recurrence.monthDayOrdinal', recurrence.monthDay || monthDay) }))}
              {chip(!!recurrence.monthWeekday, () => setMonthMode(true),
                t('recurrence.onOrdinalWeekday', {
                  ordinal: ordinalOf('recurrence.ordinal', (recurrence.monthWeekday || monthWeekday).week),
                  day: dayFull((recurrence.monthWeekday || monthWeekday).day),
                }))}
            </div>
          )}

          {heading(t('recurrence.anchorLabel'))}
          <div className="grid grid-cols-2 gap-2">
            {chip(!afterCompletion, () => setRecurrence(setRecurrenceAnchor(recurrence, 'fixed')), t('recurrence.anchorFixed'), { 'data-recurrence-anchor': 'fixed' })}
            {chip(afterCompletion, () => setRecurrence(setRecurrenceAnchor(recurrence, 'completion')), t('recurrence.anchorCompletion'), { 'data-recurrence-anchor': 'completion' })}
          </div>
        </div>
      )}
    </div>
  );
};

export default RecurrencePicker;
