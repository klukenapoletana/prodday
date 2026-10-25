// Reminders set on one task (the editor's Reminders field,
// components/TaskRemindersField.jsx). They live on the task as `reminders`, a
// list the user edits, so they travel with it through both sync tiers like its
// title. A series keeps them on the template and every occurrence has them.
//
// Three kinds:
//   { id, kind: 'before', minutes }        minutes before a timed start (0 = at the start)
//   { id, kind: 'day', daysBefore, time }  on the task's day, or n days before, at a time
//   { id, kind: 'at', at }                 a fixed local 'YYYY-MM-DDTHH:MM'
//
// 'before' needs a start time, so an all-day occurrence skips it; 'before' and
// 'day' need a date, so an Inbox task only fires 'at'. A completed task fires
// nothing. These are independent of the global reminder settings
// (useReminderEngine's categories): the user asked for each one explicitly.

import { dateToString } from './taskUtils.js';
import { getOccurrencesInRange } from './recurrenceEngine.js';

export const REMINDER_KINDS = ['before', 'day', 'at'];
// How far ahead the native layer is given alarms, and how many at most: the
// list is replaced on every change, and Android caps an app's pending alarms.
export const REMINDER_HORIZON_DAYS = 30;
export const REMINDER_LIMIT = 200;
// The furthest a 'day' reminder may sit before its task (the editor's range).
export const MAX_DAYS_BEFORE = 30;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;

/** A reminder as stored, or null when it is not one of the kinds above. */
export function normalizeReminder(r) {
  if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !r.id) return null;
  if (r.kind === 'before') {
    const minutes = Number(r.minutes);
    return Number.isInteger(minutes) && minutes >= 0 && minutes <= 60 * 24 * MAX_DAYS_BEFORE
      ? { id: r.id, kind: 'before', minutes } : null;
  }
  if (r.kind === 'day') {
    const daysBefore = Number(r.daysBefore);
    return Number.isInteger(daysBefore) && daysBefore >= 0 && daysBefore <= MAX_DAYS_BEFORE && TIME.test(r.time)
      ? { id: r.id, kind: 'day', daysBefore, time: r.time } : null;
  }
  if (r.kind === 'at') return LOCAL_DATETIME.test(r.at) ? { id: r.id, kind: 'at', at: r.at } : null;
  return null;
}

/** The task's valid reminders (an absent or broken field is none). */
export const remindersOf = (task) =>
  (Array.isArray(task?.reminders) ? task.reminders.map(normalizeReminder).filter(Boolean) : []);

/**
 * The fields a save writes: `reminders` when there are any, and the key gone
 * when there are none, so a task that never had one keeps its shape and an
 * emptied list does not linger as []. `undefined` means the caller never
 * loaded them (an editor opened by some other path): the task keeps its own.
 */
export function withReminders(task, reminders) {
  if (reminders === undefined) return task;
  const list = (reminders || []).map(normalizeReminder).filter(Boolean);
  const { reminders: _old, ...rest } = task;
  return list.length ? { ...rest, reminders: list } : rest;
}

/** Whether two reminders fire at the same point, whatever their ids. */
export const sameReminder = (a, b) => {
  const x = normalizeReminder(a);
  const y = normalizeReminder(b);
  if (!x || !y || x.kind !== y.kind) return false;
  if (x.kind === 'before') return x.minutes === y.minutes;
  if (x.kind === 'day') return x.daysBefore === y.daysBefore && x.time === y.time;
  return x.at === y.at;
};

const atLocal = (dateStr, time) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
};

/**
 * When `reminder` fires for one occurrence ({ date, startTime, isAllDay }; a
 * task without a date is an Inbox task), or null when it does not apply.
 */
export function reminderTime(reminder, occurrence) {
  const r = normalizeReminder(reminder);
  if (!r) return null;
  if (r.kind === 'at') {
    const [date, time] = r.at.split('T');
    return atLocal(date, time);
  }
  if (!occurrence?.date) return null;
  if (r.kind === 'day') {
    const d = atLocal(occurrence.date, r.time);
    d.setDate(d.getDate() - r.daysBefore);
    return d;
  }
  if (occurrence.isAllDay || !TIME.test(occurrence.startTime || '')) return null;
  return new Date(atLocal(occurrence.date, occurrence.startTime).getTime() - r.minutes * 60000);
}

const shiftDays = (dateStr, n) => {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return dateToString(d);
};

/**
 * Every reminder that fires in [from, to), soonest first and at most `limit`,
 * as { key, taskId, title, at (ms), reminderId, startTime, date }. `key` is
 * stable for one reminder on one occurrence, so a scheduler can tell a moved
 * reminder from an unchanged one. Occurrences of a series are keyed by their
 * instance id (recurring-<template>-<date>), the id the rest of the app uses.
 */
export function upcomingReminders({ tasks = [], unscheduledTasks = [], recurringTasks = [], from, to, limit = REMINDER_LIMIT }) {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const out = [];
  const push = (task, occurrence, taskId, { series = false } = {}) => {
    for (const r of remindersOf(task)) {
      // A fixed moment belongs to one task, not to every occurrence of a series.
      if (series && r.kind === 'at') continue;
      const at = reminderTime(r, occurrence);
      if (!at) continue;
      const ms = at.getTime();
      if (ms < fromMs || ms >= toMs) continue;
      out.push({
        key: `rem-${r.id}-${taskId}`,
        taskId,
        title: occurrence.title ?? task.title,
        at: ms,
        reminderId: r.id,
        date: occurrence.date || null,
        startTime: occurrence.isAllDay ? null : (occurrence.startTime || null),
      });
    }
  };

  for (const task of [...tasks, ...unscheduledTasks]) {
    if (task.completed || task.isExample || !task.reminders) continue;
    push(task, task, task.id);
  }

  // A 'day' reminder can fire up to MAX_DAYS_BEFORE ahead of its occurrence,
  // so the occurrences looked at run that much past the window.
  const rangeStart = dateToString(from);
  const rangeEnd = shiftDays(dateToString(to), MAX_DAYS_BEFORE);
  for (const template of recurringTasks) {
    if (template.isExample || !template.reminders) continue;
    for (const date of getOccurrencesInRange(template, rangeStart, rangeEnd)) {
      const exception = template.exceptions?.[date];
      if (exception?.deleted || exception?.skipped || exception?.completed) continue;
      if ((template.completedDates || []).includes(date)) continue;
      push(template, {
        date,
        title: exception?.title ?? template.title,
        startTime: exception?.startTime ?? template.startTime,
        isAllDay: exception?.isAllDay ?? template.isAllDay ?? false,
      }, `recurring-${template.id}-${date}`, { series: true });
    }
  }

  return out.sort((a, b) => a.at - b.at).slice(0, limit);
}
