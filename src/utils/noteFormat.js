// The note editor's format bar (NotesSubtasksPanel `formatBar`): each button
// edits the text around the selection the way renderFormattedText
// (utils/textFormatting.jsx) reads it. Pure, so the textarea only applies the
// result; the same shape as indentLines (utils/noteIndent.js), which the
// indent buttons use as it is.
//
// - Inline marks wrap the selection, or with a bare caret insert a pair with
//   the caret between them, so the next word typed gets the mark. Applied
//   again to marked text they take the mark off. A selection over several
//   lines marks each line, since a mark never spans a line break.
// - Line formats (heading, bullet, checklist) go at the start of every line
//   the selection touches, after its indent, replacing another line format;
//   applied to lines that all have it already, they take it off.
// - A code block fences the selection on lines of its own.

import { indentLines } from './noteIndent.js';

const INLINE = { bold: '**', italic: '*', underline: '__', strike: '~~', code: '`' };
const LINE = { heading: '# ', bullet: '- ', checklist: '- [ ] ' };

/** The bar's buttons, in order. */
export const NOTE_FORMATS = ['bold', 'italic', 'underline', 'strike', 'code', 'heading', 'bullet', 'checklist', 'indent', 'outdent', 'codeblock'];

// The line range [first, last) a selection touches; a selection ending at the
// very start of a line does not take that line (as indentLines).
const lineRange = (text, s, e) => {
  const first = text.lastIndexOf('\n', s - 1) + 1;
  const lastEnd = e > s && text[e - 1] === '\n' ? e - 1 : e;
  const nl = text.indexOf('\n', lastEnd);
  return { first, last: nl === -1 ? text.length : nl };
};

// Whether `mark` sits exactly at text[at] (and, for a one-character mark,
// is not part of a doubled one: "*" is italic, "**" is bold).
const markAt = (text, at, mark) => {
  if (text.slice(at, at + mark.length) !== mark) return false;
  if (mark.length > 1) return true;
  return text[at - 1] !== mark && text[at + 1] !== mark;
};

function wrapInline(text, s, e, mark) {
  const m = mark.length;
  if (s === e) {
    // The caret between an empty pair: take the pair off again.
    if (s >= m && text.slice(s - m, s) === mark && text.slice(s, s + m) === mark) {
      return { text: text.slice(0, s - m) + text.slice(s + m), start: s - m, end: s - m };
    }
    return { text: text.slice(0, s) + mark + mark + text.slice(s), start: s + m, end: s + m };
  }

  const selected = text.slice(s, e);
  if (selected.includes('\n')) {
    const { first, last } = lineRange(text, s, e);
    const lines = text.slice(first, last).split('\n');
    const allMarked = lines.every((l) => !l.trim() || (l.trim().startsWith(mark) && l.trim().endsWith(mark) && l.trim().length >= 2 * m));
    const next = lines.map((line) => {
      if (!line.trim()) return line;
      const lead = line.match(/^\s*/)[0];
      const body = line.slice(lead.length).replace(/\s+$/, '');
      const tail = line.slice(lead.length + body.length);
      return lead + (allMarked ? body.slice(m, body.length - m) : mark + body + mark) + tail;
    }).join('\n');
    return { text: text.slice(0, first) + next + text.slice(last), start: first, end: first + next.length };
  }

  // A double-tapped word often brings its trailing space: mark the word only.
  const lead = selected.length - selected.trimStart().length;
  const trail = selected.length - selected.trimEnd().length;
  const a = s + lead;
  const b = e - trail;
  if (a >= b) return { text, start: s, end: e };
  const inner = text.slice(a, b);
  if (inner.length >= 2 * m && markAt(inner, 0, mark) && markAt(inner, inner.length - m, mark)) {
    const stripped = inner.slice(m, inner.length - m);
    return { text: text.slice(0, a) + stripped + text.slice(b), start: a, end: a + stripped.length };
  }
  if (a >= m && markAt(text, a - m, mark) && markAt(text, b, mark)) {
    return { text: text.slice(0, a - m) + inner + text.slice(b + m), start: a - m, end: b - m };
  }
  return { text: text.slice(0, a) + mark + inner + mark + text.slice(b), start: a + m, end: b + m };
}

const LINE_PREFIX = /^(#{1,6}\s+|- \[[ xX]\]\s+|[-*]\s+)/;
const kindOf = (rest) => {
  if (/^#{1,6}\s+/.test(rest)) return 'heading';
  if (/^- \[[ xX]\]\s+/.test(rest)) return 'checklist';
  if (/^[-*]\s+/.test(rest)) return 'bullet';
  return null;
};

function lineFormat(text, s, e, kind) {
  const { first, last } = lineRange(text, s, e);
  const lines = text.slice(first, last).split('\n');
  const single = lines.length === 1;
  const touched = (line) => single || line.trim() !== '';
  const allHave = lines.filter(touched).every((line) => kindOf(line.replace(/^[ \t]*/, '')) === kind);

  let startShift = null;
  let total = 0;
  let offset = first;
  const next = lines.map((line) => {
    const lineStart = offset;
    offset += line.length + 1;
    if (!touched(line)) return line;
    const indent = line.match(/^[ \t]*/)[0];
    const rest = line.slice(indent.length);
    const old = rest.match(LINE_PREFIX)?.[0] ?? '';
    const prefix = allHave ? '' : LINE[kind];
    const out = indent + prefix + rest.slice(old.length);
    const delta = out.length - line.length;
    if (startShift === null) {
      // A caret inside the old prefix lands after the new one.
      const prefixEnd = lineStart + indent.length + old.length;
      startShift = s < prefixEnd ? (lineStart + indent.length + prefix.length) - s : delta;
    }
    total += delta;
    return out;
  });

  const result = text.slice(0, first) + next.join('\n') + text.slice(last);
  const newStart = Math.max(first, s + (startShift ?? 0));
  const newEnd = s === e ? newStart : Math.max(newStart, e + total);
  return { text: result, start: newStart, end: newEnd };
}

function codeBlock(text, s, e) {
  const before = s > 0 && text[s - 1] !== '\n' ? '\n' : '';
  const after = e < text.length && text[e] !== '\n' ? '\n' : '';
  const inner = text.slice(s, e);
  const open = `${before}\`\`\`\n`;
  const block = `${open}${inner}\n\`\`\`${after}`;
  const start = s + open.length;
  return { text: text.slice(0, s) + block + text.slice(e), start, end: start + inner.length };
}

/**
 * Apply format `kind` (one of NOTE_FORMATS) to `text` at the selection
 * [start, end), returning the new text and selection.
 */
export function applyNoteFormat(text, start, end, kind) {
  const value = typeof text === 'string' ? text : '';
  const s = Math.max(0, Math.min(start, end, value.length));
  const e = Math.min(value.length, Math.max(start, end));
  if (INLINE[kind]) return wrapInline(value, s, e, INLINE[kind]);
  if (LINE[kind]) return lineFormat(value, s, e, kind);
  if (kind === 'indent' || kind === 'outdent') return indentLines(value, s, e, kind === 'outdent');
  if (kind === 'codeblock') return codeBlock(value, s, e);
  return { text: value, start: s, end: e };
}
