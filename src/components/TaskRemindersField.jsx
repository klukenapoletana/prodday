import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Plus, X } from 'lucide-react';
import { useDayPlannerCtx } from '../context/DayPlannerContext.jsx';
import { dateToString } from '../utils/taskUtils.js';
import { remindersOf, sameReminder, normalizeReminder, MAX_DAYS_BEFORE } from '../utils/taskReminders.js';

// "Remind me" presets for a timed task, in minutes before its start.
const BEFORE_PRESETS = [0, 5, 10, 15, 30, 60, 120, 1440];
// "On the day" offsets, in days before.
const DAY_PRESETS = [0, 1, 2, 7];
const CUSTOM_UNITS = [['minutes', 1], ['hours', 60], ['days', 1440]];

// A preset under the "Before start" tab, which already says "before".
const presetLabel = (minutes, t) => {
  if (minutes === 0) return t('taskReminders.presetStart');
  if (minutes % 1440 === 0) return t('taskReminders.daysShort', { count: minutes / 1440 });
  if (minutes % 60 === 0) return t('taskReminders.hoursShort', { count: minutes / 60 });
  return t('taskReminders.minutesShort', { count: minutes });
};

/** How a reminder reads on its chip: "15 min before", "Day before at 18:00", "Fri 6 Nov, 17:00". */
export function reminderLabel(reminder, t, locale = 'en') {
  const r = normalizeReminder(reminder);
  if (!r) return '';
  if (r.kind === 'before') {
    if (r.minutes === 0) return t('taskReminders.atStart');
    if (r.minutes % 1440 === 0) return t('taskReminders.daysBefore', { count: r.minutes / 1440 });
    if (r.minutes % 60 === 0) return t('taskReminders.hoursBefore', { count: r.minutes / 60 });
    return t('taskReminders.minutesBefore', { count: r.minutes });
  }
  if (r.kind === 'day') {
    return r.daysBefore === 0
      ? t('taskReminders.onDayAt', { time: r.time })
      : t('taskReminders.daysBeforeAt', { count: r.daysBefore, time: r.time });
  }
  const [date, time] = r.at.split('T');
  const day = new Date(`${date}T12:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day}, ${time}`;
}

/**
 * The editor's Reminders field (utils/taskReminders.js): the task's reminders
 * as chips, and an Add panel offering what fits the task. A timed task gets
 * "before the start" and "on the day"; an all-day one "on the day"; an Inbox
 * task, which has no day, only a fixed moment; a series no fixed moment, since
 * its reminders repeat with it.
 */
const TaskRemindersField = () => {
  const { t, i18n } = useTranslation();
  const { newTask, setNewTask, darkMode, borderClass, textPrimary, textSecondary } = useDayPlannerCtx();
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  const reminders = remindersOf(newTask);

  const undated = !!newTask.openInInbox || !!newTask.keepUnscheduled;
  const series = !undated && !!newTask.recurrence;
  const timed = !undated && !newTask.isAllDay;
  const tabs = [
    ...(timed ? ['before'] : []),
    ...(undated ? [] : ['day']),
    ...(series ? [] : ['at']),
  ];

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(tabs[0]);
  const activeTab = tabs.includes(tab) ? tab : tabs[0];
  const [customCount, setCustomCount] = useState('20');
  const [customUnit, setCustomUnit] = useState('minutes');
  const [dayOffset, setDayOffset] = useState(0);
  const [dayTime, setDayTime] = useState('09:00');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [atDate, setAtDate] = useState(newTask.date && !undated ? newTask.date : dateToString(tomorrow));
  const [atTime, setAtTime] = useState('09:00');

  const setReminders = (list) => setNewTask(prev => ({ ...prev, reminders: list }));
  const add = (reminder) => {
    const r = normalizeReminder({ id: crypto.randomUUID(), ...reminder });
    if (!r) return;
    if (!reminders.some(x => sameReminder(x, r))) setReminders([...reminders, r]);
    setOpen(false);
  };
  const remove = (id) => setReminders(reminders.filter(r => r.id !== id));

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
  const field = `px-2 py-1.5 text-sm border ${borderClass} rounded-lg ${darkMode ? 'bg-gray-700 text-white' : 'bg-white'}`;
  const addButton = (onClick, disabled = false) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-reminder-add
      className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50"
    >
      {t('taskReminders.add')}
    </button>
  );

  const customMinutes = (() => {
    const n = Number(customCount);
    const factor = CUSTOM_UNITS.find(([u]) => u === customUnit)[1];
    return Number.isInteger(n) && n >= 1 ? n * factor : null;
  })();

  return (
    <div data-task-reminders>
      <label className={`flex items-center gap-1.5 text-sm ${textSecondary} mb-1`}>
        <Bell size={14} />
        {t('taskReminders.title')}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {reminders.map(r => (
          <span
            key={r.id}
            data-reminder-chip
            className={`inline-flex items-center gap-1 pl-2.5 pr-1 py-1 text-sm rounded-full border ${borderClass} ${idle}`}
          >
            {reminderLabel(r, t, locale)}
            <button
              type="button"
              onClick={() => remove(r.id)}
              aria-label={t('taskReminders.remove')}
              className={`p-0.5 rounded-full ${textSecondary}`}
            >
              <X size={14} />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          data-reminder-open
          className={`inline-flex items-center gap-1 px-2.5 py-1 text-sm rounded-full border border-dashed ${borderClass} ${textSecondary}`}
        >
          <Plus size={14} />
          {t('taskReminders.addReminder')}
        </button>
      </div>

      {open && (
        <div className={`mt-2 p-2.5 rounded-lg border ${borderClass} ${darkMode ? 'bg-gray-800' : 'bg-stone-50'}`} data-reminder-panel>
          {tabs.length > 1 && (
            <div className="grid gap-1.5 mb-2.5" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
              {tabs.map(name => (
                <React.Fragment key={name}>
                  {chip(activeTab === name, () => setTab(name), t(`taskReminders.tab_${name}`), { 'data-reminder-tab': name })}
                </React.Fragment>
              ))}
            </div>
          )}

          {activeTab === 'before' && (
            <>
              <div className="grid grid-cols-4 gap-1.5">
                {BEFORE_PRESETS.map(minutes => (
                  <React.Fragment key={minutes}>
                    {chip(false, () => add({ kind: 'before', minutes }), presetLabel(minutes, t), { 'data-reminder-preset': minutes })}
                  </React.Fragment>
                ))}
              </div>
              <span className={`block text-xs font-medium ${textSecondary} mt-2.5 mb-1.5`}>{t('taskReminders.custom')}</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={customCount}
                  onChange={(e) => setCustomCount(e.target.value)}
                  aria-label={t('taskReminders.custom')}
                  className={`w-16 ${field}`}
                />
                <select value={customUnit} onChange={(e) => setCustomUnit(e.target.value)} className={`flex-1 min-w-0 ${field}`}>
                  {CUSTOM_UNITS.map(([unit]) => (
                    <option key={unit} value={unit}>{t(`taskReminders.unit_${unit}`)}</option>
                  ))}
                </select>
                {addButton(() => add({ kind: 'before', minutes: customMinutes }),
                  !customMinutes || customMinutes > MAX_DAYS_BEFORE * 1440)}
              </div>
            </>
          )}

          {activeTab === 'day' && (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                {DAY_PRESETS.map(days => (
                  <React.Fragment key={days}>
                    {chip(dayOffset === days, () => setDayOffset(days),
                      days === 0 ? t('taskReminders.sameDay') : t('taskReminders.daysBefore', { count: days }),
                      { 'data-reminder-days': days })}
                  </React.Fragment>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2.5">
                <span className={`text-sm ${textSecondary}`}>{t('taskReminders.time')}</span>
                <input type="time" value={dayTime} onChange={(e) => setDayTime(e.target.value)} className={`flex-1 min-w-0 ${field}`} data-reminder-day-time />
                {addButton(() => add({ kind: 'day', daysBefore: dayOffset, time: dayTime }), !dayTime)}
              </div>
            </>
          )}

          {activeTab === 'at' && (
            <div className="flex items-center gap-2">
              <input type="date" value={atDate} onChange={(e) => setAtDate(e.target.value)} className={`flex-1 min-w-0 ${field}`} aria-label={t('taskReminders.date')} data-reminder-at-date />
              <input type="time" value={atTime} onChange={(e) => setAtTime(e.target.value)} className={`w-24 ${field}`} aria-label={t('taskReminders.time')} data-reminder-at-time />
              {addButton(() => add({ kind: 'at', at: `${atDate}T${atTime}` }), !atDate || !atTime)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskRemindersField;
