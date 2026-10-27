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
//
// A note can be pinned (`pinned`): pinned notes lead the list. The pin is the
// Notes area's too and goes with the note flag.

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
  const { isNote: _n, pinned: _p, ...rest } = task;
  return { ...rest, priority: rest.priority ?? 0, lastModified: now };
};

/** The note flag dropped, nothing else touched (a scheduling path's copy). */
export const stripNote = (task) => {
  const { isNote: _n, pinned: _p, ...rest } = task;
  return rest;
};

/**
 * The first lines of a note's text for its card in the Notes tab, its
 * formatting kept for renderFormattedText (utils/textFormatting.jsx). Blank
 * lines before the text are dropped and runs of them kept to one; a code
 * block the cut leaves open is closed, so the card does not show a bare fence.
 */
export const noteExcerpt = (text, maxLines = 5) => {
  if (typeof text !== 'string' || !text.trim()) return '';
  const lines = [];
  for (const line of text.split('\n')) {
    if (!line.trim() && (!lines.length || !lines[lines.length - 1].trim())) continue;
    lines.push(line);
    if (lines.filter((l) => l.trim()).length >= maxLines) break;
  }
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const fences = lines.filter((l) => l.trim().startsWith('```')).length;
  return fences % 2 ? `${lines.join('\n')}\n\`\`\`` : lines.join('\n');
};

/** The notes, pinned ones first, each group most recently changed first. */
export const sortNotes = (notes) => [...notes].sort((a, b) =>
  (Number(!!b.pinned) - Number(!!a.pinned))
  || String(b.lastModified || b.createdAt || '').localeCompare(String(a.lastModified || a.createdAt || '')));
