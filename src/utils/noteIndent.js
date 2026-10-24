// Tab and Shift+Tab in a note: indent or outdent every line the selection
// touches by one step (two spaces, the unit renderFormattedText reads as one
// level). Pure, so the textarea only applies the result.

export const INDENT = '  ';

/**
 * @param {string} text            the note
 * @param {number} start           selection start
 * @param {number} end             selection end (equal to start for a caret)
 * @param {boolean} outdent        Shift+Tab
 * @returns {{ text: string, start: number, end: number }} the note and the
 *   selection after the change, shifted with the lines it sits on
 */
export function indentLines(text, start, end, outdent = false) {
  const s = Math.min(start, end);
  const e = Math.max(start, end);
  const first = text.lastIndexOf('\n', s - 1) + 1;
  // A selection ending at the very start of a line does not take that line.
  const lastEnd = e > s && text[e - 1] === '\n' ? e - 1 : e;
  const nl = text.indexOf('\n', lastEnd);
  const last = nl === -1 ? text.length : nl;

  const lines = text.slice(first, last).split('\n');
  let startShift = 0;
  let total = 0;
  const next = lines.map((line, i) => {
    let delta;
    let out;
    if (outdent) {
      const removed = line.startsWith('\t') ? 1 : (line.match(/^ {1,2}/)?.[0].length ?? 0);
      out = line.slice(removed);
      delta = -removed;
    } else {
      out = INDENT + line;
      delta = INDENT.length;
    }
    if (i === 0) startShift = delta;
    total += delta;
    return out;
  });

  const result = text.slice(0, first) + next.join('\n') + text.slice(last);
  // The caret never moves left of its line's start when that line loses indent.
  const newStart = Math.max(first, s + startShift);
  const newEnd = s === e ? newStart : Math.max(newStart, e + total);
  return { text: result, start: newStart, end: newEnd };
}
