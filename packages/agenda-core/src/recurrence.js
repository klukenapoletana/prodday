// Recurrence expansion — MOVED verbatim from src/utils/recurrenceEngine.js
// (2026-09-02) so the Obsidian plugin's agenda view expands recurring
// series with the SAME code the app does. src/utils/recurrenceEngine.js
// is now a re-export shim; nothing else about this module changed.

const dateToString = (date) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * How many units a series steps between occurrences: `recurrence.interval`
 * when it is a whole number above 1 ("every 4 days", "every 3 weeks"), else 1.
 * Absent on every series made before intervals existed, which therefore
 * expand exactly as they always did. 'biweekly' is the older spelling of
 * weekly every 2 and keeps its own type.
 */
export const recurrenceInterval = (rec) =>
  (Number.isInteger(rec?.interval) && rec.interval > 1 ? rec.interval : 1);

/**
 * Whether a series falls on every single day. The app treats those apart
 * (no "move to tomorrow": tomorrow has one anyway); a daily series with an
 * interval does not qualify.
 */
// An after-completion series is not one: its next day depends on the tick.
export const isEveryDay = (rec) =>
  rec?.type === 'daily' && recurrenceInterval(rec) === 1 && rec.anchor !== 'completion';

/**
 * The `recurrenceType` an expanded occurrence carries: the series' type,
 * except that a daily series with an interval reads 'daily-interval', so the
 * every-day special cases (which test recurrenceType === 'daily') skip it.
 */
export const occurrenceRecurrenceType = (rec) =>
  (rec?.type === 'daily' && !isEveryDay(rec) ? 'daily-interval' : rec?.type);

// ── "After completion" series ────────────────────────────────────────────────
// recurrence.anchor === 'completion': the next occurrence is counted from the
// day the previous one was ticked off, not from a fixed rhythm. Such a series
// has one open occurrence at a time; its done ones stay where they were due.
//
// The open one ("pending") is found from the done set (completedDates, plus
// occurrences skipped or deleted by an exception):
//   - nothing done since startDate (or startDate after the last done one,
//     which is how a moved series re-anchors): startDate itself;
//   - otherwise interval units after the day the last done one was ticked
//     off (completedDatesTimestamps, written by every toggle), never on or
//     before that last done one's own date. A done one without a stamp (a
//     skip, an older row) counts from its own date.
// Weekdays and the day of the month play no part: every 2 weeks after
// completion is 14 days after the tick.

/** Whether a series counts each occurrence from the previous one's completion. */
export const isCompletionAnchored = (rec) => rec?.anchor === 'completion';

const noonOf = (dateStr) => new Date(dateStr + 'T12:00:00');

/** `dateStr` plus the series' step (n days, weeks, months or years), clamping month ends. */
const stepFrom = (dateStr, rec) => {
  const n = rec.type === 'biweekly' ? 2 : recurrenceInterval(rec);
  const d = noonOf(dateStr);
  if (rec.type === 'weekly' || rec.type === 'biweekly') {
    d.setDate(d.getDate() + 7 * n);
  } else if (rec.type === 'monthly' || rec.type === 'yearly') {
    const months = rec.type === 'monthly' ? n : 12 * n;
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  } else {
    d.setDate(d.getDate() + n);
  }
  return dateToString(d);
};

const localDayOf = (iso) => {
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? null : dateToString(t);
};

/**
 * The open occurrence of an after-completion series (YYYY-MM-DD), or null
 * when the series is over (endDate, maxOccurrences) or has no start.
 */
export const getPendingOccurrence = (template) => {
  const rec = template?.recurrence;
  if (!rec?.startDate) return null;
  const completed = template.completedDates || [];
  if (rec.maxOccurrences && completed.length >= rec.maxOccurrences) return null;
  const done = new Set(completed);
  for (const [date, ex] of Object.entries(template.exceptions || {})) {
    if (ex?.deleted || ex?.skipped) done.add(date);
  }
  let lastDone = null;
  for (const date of done) if (!lastDone || date > lastDone) lastDone = date;

  let pending;
  if (!lastDone || rec.startDate > lastDone) {
    pending = rec.startDate;
  } else {
    const stamp = completed.includes(lastDone) ? template.completedDatesTimestamps?.[lastDone] : null;
    const next = stepFrom((stamp && localDayOf(stamp)) || lastDone, rec);
    const dayAfter = noonOf(lastDone);
    dayAfter.setDate(dayAfter.getDate() + 1);
    const floor = dateToString(dayAfter);
    pending = next > floor ? next : floor;
  }
  if (rec.endDate && pending > rec.endDate) return null;
  return pending;
};

/**
 * Move an after-completion series' open occurrence from `fromDate` to
 * `toDate`, as a NEW template: the series re-anchors there (startDate), and
 * the moved occurrence's own overrides go with it, merged with `overrides`
 * (a new start time, all-day). Null when that is not what the move means:
 * not such a series, `fromDate` is not its open occurrence, or `toDate` is
 * not after its last done one. Callers fall back to their usual handling.
 */
export const reanchorCompletionSeries = (template, fromDate, toDate, overrides = {}) => {
  if (!isCompletionAnchored(template?.recurrence)) return null;
  if (!toDate || getPendingOccurrence(template) !== fromDate) return null;
  const moved = { ...template, recurrence: { ...template.recurrence, startDate: toDate } };
  if (getPendingOccurrence(moved) !== toDate) return null;
  const { [fromDate]: fromException, ...exceptions } = template.exceptions || {};
  const { deleted: _d, skipped: _s, completed: _c, ...carried } = { ...(fromException || {}), ...overrides };
  if (Object.keys(carried).length) exceptions[toDate] = { ...(exceptions[toDate] || {}), ...carried };
  return { ...moved, exceptions };
};

/**
 * Compute all occurrence date strings (YYYY-MM-DD) of a recurring task template
 * that fall within [rangeStartStr, rangeEndStr] inclusive.
 *
 * Optimised with fast-forward logic so it doesn't iterate every day from the
 * start date when the range is far in the future.
 *
 * `maxResults` stops the walk once that many occurrences are in hand. Callers
 * that only need the next one (getNextOccurrence, and through it the project
 * views) would otherwise materialise the whole window to read element 0 — a
 * daily series over two years built 732 dates to return one.
 */
export const getOccurrencesInRange = (template, rangeStartStr, rangeEndStr, maxResults = Infinity) => {
  const rec = template.recurrence;
  if (!rec) return [];
  if (isCompletionAnchored(rec)) {
    // The done ones where they were due, and the one open occurrence.
    const dates = new Set(template.completedDates || []);
    const pending = getPendingOccurrence(template);
    if (pending) dates.add(pending);
    const hidden = (d) => template.exceptions?.[d]?.deleted || template.exceptions?.[d]?.skipped;
    return [...dates]
      .filter((d) => d >= rangeStartStr && d <= rangeEndStr && !hidden(d))
      .sort()
      .slice(0, maxResults);
  }
  const results = [];
  const startDate = new Date(rec.startDate + 'T12:00:00');
  const rangeStart = new Date(rangeStartStr + 'T12:00:00');
  const rangeEnd = new Date(rangeEndStr + 'T12:00:00');
  const endDate = rec.endDate ? new Date(rec.endDate + 'T12:00:00') : null;
  let count = 0;
  const maxOcc = rec.maxOccurrences || Infinity;

  const addIfInRange = (d) => {
    if (count >= maxOcc) return false;
    if (endDate && d > endDate) return false;
    const ds = dateToString(d);
    if (template.exceptions && (template.exceptions[ds]?.deleted || template.exceptions[ds]?.skipped)) { count++; return true; }
    if (d >= rangeStart && d <= rangeEnd) results.push(ds);
    count++;
    return results.length < maxResults;
  };

  if (rec.type === 'daily') {
    // Every `step` days from startDate. Fast-forward: skip directly to the
    // first occurrence on or after rangeStart instead of iterating from a
    // potentially distant startDate; count the occurrences skipped so
    // maxOccurrences still works.
    const step = recurrenceInterval(rec);
    const cursor = new Date(startDate);
    if (rangeStart > startDate) {
      // All noon-anchored dates, so dividing by 86400000 and rounding handles DST correctly.
      const days = Math.round((rangeStart.getTime() - startDate.getTime()) / 86400000);
      count = Math.ceil(days / step);
      cursor.setDate(cursor.getDate() + count * step);
    }
    while (cursor <= rangeEnd && count < maxOcc) {
      if (endDate && cursor > endDate) break;
      if (!addIfInRange(cursor)) break;
      cursor.setDate(cursor.getDate() + step);
    }
  } else if (rec.type === 'weekly' || rec.type === 'biweekly') {
    const step = rec.type === 'biweekly' ? 2 : recurrenceInterval(rec);
    const days = (rec.daysOfWeek && rec.daysOfWeek.length > 0) ? rec.daysOfWeek : [startDate.getDay()];
    // Copied before sorting: `days` is often rec.daysOfWeek itself, and this
    // runs inside render-path memos — sorting in place mutated the template
    // held in React state. Hoisted out of the loop while we're here.
    const sortedDays = [...days].sort((a, b) => a - b);
    // Find the week start (Sunday) of the start date
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    // Fast-forward weekStart to the week that contains rangeStart, adjusting count.
    if (rangeStart > startDate) {
      const rangeWeekStart = new Date(rangeStart);
      rangeWeekStart.setDate(rangeWeekStart.getDate() - rangeWeekStart.getDay());
      const msPerCycle = 7 * step * 86400000;
      const cyclesSkip = Math.max(0, Math.floor((rangeWeekStart.getTime() - weekStart.getTime()) / msPerCycle));
      if (cyclesSkip > 0) {
        weekStart.setDate(weekStart.getDate() + cyclesSkip * 7 * step);
        // The first cycle may start partway through its selected weekdays.
        // Count its eligible days plus every complete cycle skipped after it,
        // including occurrences hidden by exceptions, just like addIfInRange.
        const firstCycleCount = days.filter((dow) => dow >= startDate.getDay()).length;
        count = firstCycleCount + (cyclesSkip - 1) * days.length;
      }
    }
    const cursor = new Date(weekStart);
    let stop = false;
    while (!stop && cursor <= rangeEnd && count < maxOcc) {
      for (const dow of sortedDays) {
        const d = new Date(cursor);
        d.setDate(d.getDate() + dow);
        if (d < startDate) continue;
        if (endDate && d > endDate) { stop = true; break; }
        if (d > rangeEnd) { stop = true; break; }
        if (!addIfInRange(d)) { stop = true; break; }
      }
      cursor.setDate(cursor.getDate() + 7 * step);
    }
  } else if (rec.type === 'monthly') {
    const step = recurrenceInterval(rec);
    const cursor = new Date(startDate);
    cursor.setDate(1);
    while (cursor <= rangeEnd && count < maxOcc) {
      let target;
      if (rec.monthWeekday) {
        // Nth weekday of month (e.g., 1st Monday)
        const { week, day } = rec.monthWeekday;
        const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        const firstDow = firstOfMonth.getDay();
        let offset = day - firstDow;
        if (offset < 0) offset += 7;
        target = new Date(firstOfMonth);
        target.setDate(1 + offset + (week - 1) * 7);
        // Verify still in same month
        if (target.getMonth() !== cursor.getMonth()) {
          cursor.setMonth(cursor.getMonth() + step, 1);
          continue;
        }
      } else {
        const md = rec.monthDay || startDate.getDate();
        const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
        target = new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(md, daysInMonth));
      }
      target.setHours(12, 0, 0, 0);
      if (target >= startDate) {
        if (endDate && target > endDate) break;
        if (!addIfInRange(target)) break;
      }
      cursor.setMonth(cursor.getMonth() + step, 1);
    }
  } else if (rec.type === 'yearly') {
    // Each year's date comes from the START's month and day, not from the
    // previous occurrence. Stepping a running cursor (setFullYear + 1) carried
    // 29 February's overflow forward: 2024-02-29 became 2025-03-01 and then
    // stayed on 1 March, leap years included. A 29 February series still
    // shows on 1 March in years without one (Date's own overflow), as it
    // always has, so occurrences already saved against those dates keep
    // matching; only leap years return to the 29th.
    const month = startDate.getMonth();
    const day = startDate.getDate();
    const step = recurrenceInterval(rec);
    for (let year = startDate.getFullYear(); count < maxOcc; year += step) {
      const cursor = new Date(year, month, day, 12);
      if (cursor > rangeEnd) break;
      if (endDate && cursor > endDate) break;
      if (!addIfInRange(cursor)) break;
    }
  }
  return results;
};

// How far ahead getNextOccurrence is willing to look. Only a backstop against
// a pathological search: every real termination comes from the series itself
// (endDate, maxOccurrences) or from finding the occurrence. It was two years,
// which quietly reported "no next occurrence" for a series starting further
// out than that — and callers read that as "ended".
const NEXT_OCCURRENCE_HORIZON_YEARS = 10;

/**
 * Return the next occurrence date string (YYYY-MM-DD) of a recurring task
 * on or after today, or null if the series has no future occurrences.
 */
export const getNextOccurrence = (template) => {
  const today = dateToString(new Date());
  const futureEnd = new Date();
  futureEnd.setFullYear(futureEnd.getFullYear() + NEXT_OCCURRENCE_HORIZON_YEARS);
  const futureEndStr = dateToString(futureEnd);
  const [next] = getOccurrencesInRange(template, today, futureEndStr, 1);
  return next ?? null;
};

/**
 * Return the standard set of recurrence preset options for a given date string.
 * Used to populate the recurrence picker dropdown in the task editor.
 */
export const getRecurrencePresets = (dateStr, t, language = 'en') => {
  const taskDate = new Date(dateStr + 'T12:00:00');
  const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][taskDate.getDay()];
  const monthDay = taskDate.getDate();
  const monthName = ['January','February','March','April','May','June','July','August','September','October','November','December'][taskDate.getMonth()];
  const suffix = monthDay === 1 || monthDay === 21 || monthDay === 31 ? 'st' : monthDay === 2 || monthDay === 22 ? 'nd' : monthDay === 3 || monthDay === 23 ? 'rd' : 'th';
  const weekOfMonth = Math.ceil(monthDay / 7);
  const ordinals = ['','1st','2nd','3rd','4th','5th'];
  const translate = (key, values, fallback) => typeof t === 'function'
    ? t(key, { ...values, defaultValue: fallback })
    : fallback;
  const localizedDay = typeof t === 'function'
    ? new Intl.DateTimeFormat(language || 'en', { weekday: 'long' }).format(taskDate)
    : dayName;
  const localizedDate = typeof t === 'function'
    ? new Intl.DateTimeFormat(language || 'en', { month: 'long', day: 'numeric' }).format(taskDate)
    : `${monthName} ${monthDay}`;
  // Two ordinal keys, not one. A month DAY and an ordinal POSITION are the
  // same word in English ("the 5th", "the 2nd Monday") and diverge in French,
  // where the day is cardinal after the first ("le 5", but "le 1er") while the
  // position stays ordinal ("le 2e lundi"). Sharing one key made French wrong
  // on one side whichever way it was written.
  const localizedMonthDay = translate('recurrence.monthDayOrdinal', { count: monthDay, ordinal: true }, `${monthDay}${suffix}`);
  const localizedOrdinal = translate('recurrence.ordinal', { count: weekOfMonth, ordinal: true }, ordinals[weekOfMonth]);

  return [
    { label: translate('task.noRepeat', {}, 'None'), value: null },
    { label: translate('recurrence.everyDay', {}, 'Every day'), value: { type: 'daily' } },
    taskDate.getDay() === 0 || taskDate.getDay() === 6
      ? { label: translate('recurrence.everyWeekend', {}, 'Every weekend (Sat-Sun)'), value: { type: 'weekly', daysOfWeek: [0,6] } }
      : { label: translate('recurrence.everyWeekday', {}, 'Every weekday (Mon-Fri)'), value: { type: 'weekly', daysOfWeek: [1,2,3,4,5] } },
    { label: translate('recurrence.everyWeekOn', { day: localizedDay }, `Every week on ${dayName}`), value: { type: 'weekly', daysOfWeek: [taskDate.getDay()] } },
    { label: translate('recurrence.everyTwoWeeksOn', { day: localizedDay }, `Every 2 weeks on ${dayName}`), value: { type: 'biweekly', daysOfWeek: [taskDate.getDay()] } },
    { label: translate('recurrence.monthlyOnDate', { day: localizedMonthDay }, `Monthly on the ${monthDay}${suffix}`), value: { type: 'monthly', monthDay: monthDay, monthWeekday: null } },
    { label: translate('recurrence.monthlyOnOrdinalWeekday', { ordinal: localizedOrdinal, day: localizedDay }, `Monthly on the ${ordinals[weekOfMonth]} ${dayName}`), value: { type: 'monthly', monthDay: null, monthWeekday: { week: weekOfMonth, day: taskDate.getDay() } } },
    { label: translate('recurrence.yearlyOn', { date: localizedDate }, `Yearly on ${monthName} ${monthDay}`), value: { type: 'yearly' } },
  ];
};

const noon = (dateStr) => new Date(dateStr + 'T12:00:00');
const sundayOf = (dateStr) => {
  const d = noon(dateStr);
  d.setDate(d.getDate() - d.getDay());
  return d;
};

/**
 * The startDate a series should store after its pattern is changed to
 * `recurrence` from the occurrence on `dateStr`.
 *
 * The series never starts earlier than `origStart`: the engine expands from
 * startDate, so an earlier start invents occurrences from before the series
 * existed. Most patterns carry everything they need (daysOfWeek, monthDay,
 * monthWeekday) and keep `origStart` as it is. Two take part of their pattern
 * from startDate itself:
 *
 * - yearly recurs on startDate's month and day, and
 * - biweekly takes its alternate-week phase from startDate's week.
 *
 * Keeping `origStart` for those recurs on the wrong day, or skips the
 * occurrence the edit was made from. So the start moves FORWARD to the
 * first date the new pattern, anchored on `dateStr`, produces on or after
 * `origStart`. Nothing between `origStart` and that date belonged to the new
 * pattern, so the series yields exactly the same occurrences, maxOccurrences
 * counts the same, and nothing is invented.
 *
 * An edit made from a date before `origStart` (or a series without one)
 * starts at `dateStr`, never on an invented earlier date.
 *
 * When the pattern, with `origStart`, already produces `dateStr`, nothing
 * needs to move and the start is kept. That is every ordinary save of an
 * occurrence (the mobile editor passes the unchanged pattern on each save),
 * and it matters where the engine shows an occurrence off the start's own
 * month/day: a yearly series started on 29 February shows on 1 March in other
 * years, and anchoring on that 1 March would move the series off its leap day.
 */
export const editedSeriesStart = (recurrence, origStart, dateStr) => {
  if (!origStart || dateStr < origStart) return dateStr;

  // An after-completion series counts from its completions, not from a
  // phase, so a pattern change keeps its start (moving it is
  // reanchorCompletionSeries).
  if (isCompletionAnchored(recurrence)) return origStart;

  // A series with an interval ("every 3 weeks") takes its phase from
  // startDate, whatever its type, as biweekly does. Keep the start when it
  // already produces the edited occurrence; otherwise move it forward to the
  // first start on or after origStart whose series does, so nothing is
  // invented before the edit and the edited occurrence stays.
  if (recurrenceInterval(recurrence) > 1) {
    const produces = (start) =>
      getOccurrencesInRange({ recurrence: { ...recurrence, startDate: start } }, dateStr, dateStr, 1).includes(dateStr);
    if (produces(origStart)) return origStart;
    const cursor = noon(origStart);
    const last = noon(dateStr);
    while (cursor < last) {
      cursor.setDate(cursor.getDate() + 1);
      const candidate = dateToString(cursor);
      if (produces(candidate)) return candidate;
    }
    return dateStr;
  }

  if ((recurrence?.type === 'yearly' || recurrence?.type === 'biweekly')
      && getOccurrencesInRange({ recurrence: { ...recurrence, startDate: origStart } }, dateStr, dateStr, 1).includes(dateStr)) {
    return origStart;
  }

  if (recurrence?.type === 'yearly') {
    // dateStr's month and day, in the first year it falls on or after
    // origStart. The search ends at dateStr's own year at the latest; a 29
    // February is skipped in years that have none.
    const monthDay = dateStr.slice(4);
    for (let year = Number(origStart.slice(0, 4)); ; year++) {
      const candidate = String(year).padStart(4, '0') + monthDay;
      if (candidate >= origStart && dateToString(noon(candidate)) === candidate) return candidate;
    }
  }

  if (recurrence?.type === 'biweekly') {
    // Noon-anchored Sundays, so rounding absorbs DST.
    const weeks = Math.round((sundayOf(dateStr) - sundayOf(origStart)) / (7 * 86400000));
    if (weeks % 2 === 0) return origStart;
    // origStart's week is off phase, so nothing in it recurs: start on the
    // first selected day of the week after. With no daysOfWeek the engine
    // falls back to startDate's weekday, so that is dateStr's.
    const days = recurrence.daysOfWeek?.length ? recurrence.daysOfWeek : [noon(dateStr).getDay()];
    const start = sundayOf(origStart);
    start.setDate(start.getDate() + 7 + Math.min(...days));
    return dateToString(start);
  }

  return origStart;
};

const WEEKLY_TYPES = new Set(['weekly', 'biweekly']);

/**
 * Which weekdays a recurrence currently fires on, ascending (0=Sunday).
 *
 * Empty for anything that isn't weekly or biweekly. A weekly recurrence with
 * no explicit daysOfWeek fires on its start date's weekday — the engine's own
 * fallback — so the picker shows that day lit rather than nothing.
 */
export const getSelectedWeekdays = (recurrence, dateStr) => {
  if (!recurrence || !WEEKLY_TYPES.has(recurrence.type)) return [];
  if (recurrence.daysOfWeek?.length) return [...recurrence.daysOfWeek].sort((a, b) => a - b);
  const anchor = recurrence.startDate || dateStr;
  return anchor ? [new Date(anchor + 'T12:00:00').getDay()] : [];
};

/**
 * Add or remove one weekday, returning a NEW recurrence.
 *
 * Turning a day on from a non-weekly recurrence (none, daily, monthly…)
 * converts it to weekly on that day. Removing the last remaining day is
 * refused: a weekly series with no days falls back to its start date's
 * weekday, so the chip would light straight back up. End conditions (endDate,
 * maxOccurrences) survive; monthly-only fields do not.
 */
export const toggleRecurrenceDay = (recurrence, dow, dateStr) => {
  const current = getSelectedWeekdays(recurrence, dateStr);
  const next = current.includes(dow)
    ? current.filter((d) => d !== dow)
    : [...current, dow].sort((a, b) => a - b);
  if (next.length === 0) return recurrence;
  const { monthDay: _md, monthWeekday: _mw, ...rest } = recurrence || {};
  return {
    ...rest,
    type: WEEKLY_TYPES.has(recurrence?.type) ? recurrence.type : 'weekly',
    daysOfWeek: next,
  };
};

/**
 * Switch between 'weekly' and 'biweekly', keeping the chosen days. Reachable
 * from a recurrence that is neither, so the days are resolved first and fall
 * back to the task's own date.
 */
export const setRecurrenceFrequency = (recurrence, type, dateStr) => {
  const days = getSelectedWeekdays(recurrence, dateStr);
  const { monthDay: _md, monthWeekday: _mw, ...rest } = recurrence || {};
  return {
    ...rest,
    type,
    daysOfWeek: days.length ? days : [new Date(dateStr + 'T12:00:00').getDay()],
  };
};

/**
 * The seven weekday numbers starting at the user's first day of the week, so
 * the chip row reads Mon..Sun for a Monday-start user.
 */
export const weekdayOrder = (weekStartDay = 0) =>
  Array.from({ length: 7 }, (_, i) => (i + weekStartDay) % 7);

const INTERVAL_UNITS = ['daily', 'weekly', 'monthly', 'yearly'];
export const MAX_INTERVAL = 99;

/**
 * The picker's reading of a recurrence as "every n <unit>": weekly and
 * biweekly are both weeks (biweekly is every 2). Null for no recurrence.
 */
export const recurrenceUnitAndInterval = (recurrence) => {
  if (!recurrence) return null;
  if (recurrence.type === 'biweekly') return { unit: 'weekly', n: 2 };
  if (!INTERVAL_UNITS.includes(recurrence.type)) return null;
  return { unit: recurrence.type, n: recurrenceInterval(recurrence) };
};

/**
 * "Every n <unit>" as a NEW recurrence, from whatever is selected now.
 *
 * Every 1 stores no interval, so it is the plain series it always was, and
 * weekly every 2 is stored as 'biweekly', the existing spelling, so the two
 * week buttons keep lighting up for it. What the unit can keep is kept:
 * weekdays stay on a weekly series (or fall back to the task's own day), the
 * day of the month or "2nd Tuesday" on a monthly one. End conditions
 * (endDate, maxOccurrences) are the caller's to keep, as for the presets.
 */
export const setRecurrenceInterval = (recurrence, unit, n, dateStr) => {
  if (!INTERVAL_UNITS.includes(unit)) return recurrence;
  const count = Math.min(MAX_INTERVAL, Math.max(1, Math.round(Number(n)) || 1));
  const anchor = isCompletionAnchored(recurrence) ? { anchor: 'completion' } : {};
  const withInterval = (rec) => ({ ...rec, ...(count > 1 ? { interval: count } : {}), ...anchor });
  if (unit === 'weekly') {
    const days = getSelectedWeekdays(recurrence, dateStr);
    const daysOfWeek = days.length ? days : [new Date(dateStr + 'T12:00:00').getDay()];
    if (count === 2) return { type: 'biweekly', daysOfWeek, ...anchor };
    return withInterval({ type: 'weekly', daysOfWeek });
  }
  if (unit === 'monthly') {
    const keep = recurrence?.type === 'monthly'
      ? { monthDay: recurrence.monthDay ?? null, monthWeekday: recurrence.monthWeekday ?? null }
      : { monthDay: new Date(dateStr + 'T12:00:00').getDate(), monthWeekday: null };
    return withInterval({ type: 'monthly', ...keep });
  }
  return withInterval({ type: unit });
};

/**
 * Switch a recurrence between a fixed rhythm and "after completion", as a NEW
 * recurrence. Everything else (unit, interval, days, end conditions) stays.
 */
export const setRecurrenceAnchor = (recurrence, anchor) => {
  if (!recurrence) return recurrence;
  const { anchor: _old, ...rest } = recurrence;
  return anchor === 'completion' ? { ...rest, anchor: 'completion' } : rest;
};
