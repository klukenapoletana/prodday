// Notes: the third area beside the Inbox and the timeline (the Notes tab).
//
// A note is an entry like any other (title, colour, notes text with its
// formatting, a checklist), without a day and without a tick. It IS an
// unscheduledTasks row, marked `isNote`, the way a Bucket List item is one
// marked `bucketId` (utils/bucketList.js): the same sync, backup, undo and
// recycle-bin machinery for free, and the Inbox leaves it out through the one
// exclusion every Inbox consumer already applies (notBucketed). So an entry
// moves between the three areas without changing what it is: the Inbox and a
// note differ by the flag, the timeline by a day.
//
// The flag is the Notes area's alone: a note sent to the timeline or the
// Inbox drops it (fromNote, toInboxCopy, the scheduling paths), so a task
// later sent back to the Inbox lands there and not among the notes.

/** True when an entry lives in the Notes area. */
export const isNote = (task) => !!task?.isNote;

/**
 * An Inbox entry as a note. Deadline and priority go, as for the Bucket List:
 * a note does not nag, and a deadline that resurfaced as overdue when it moved
 * back would be worse than losing it.
 */
export const toNote = (task, now = new Date().toISOString()) => {
  const { deadline: _d, priority: _p, bucketId: _b, ...rest } = task;
  return { ...rest, isNote: true, lastModified: now };
};

/** A note back to the Inbox (or on its way to the timeline). */
export const fromNote = (task, now = new Date().toISOString()) => {
  const { isNote: _n, ...rest } = task;
  return { ...rest, priority: rest.priority ?? 0, lastModified: now };
};

/** The note flag dropped, nothing else touched (a scheduling path's copy). */
export const stripNote = (task) => {
  const { isNote: _n, ...rest } = task;
  return rest;
};

/** First lines of a note's text as plain words, for its card. */
export const notePreview = (text, maxLines = 3) => {
  if (typeof text !== 'string' || !text.trim()) return '';
  return text
    .split('\n')
    .map((line) => line
      .replace(/^\s*(?:[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+|>\s*|#{1,6}\s+)/, '')
      .replace(/(\*\*|__|~~|==|`)/g, '')
      .replace(/(^|\s)[*_](\S[^*_]*\S|\S)[*_](?=\s|$)/g, '$1$2')
      .replace(/<\/?[a-z][^>]*>/gi, '')
      .trim())
    .filter(Boolean)
    .slice(0, maxLines)
    .join('\n');
};

/** The notes, most recently changed first. */
export const sortNotes = (notes) => [...notes].sort((a, b) =>
  String(b.lastModified || b.createdAt || '').localeCompare(String(a.lastModified || a.createdAt || '')));
