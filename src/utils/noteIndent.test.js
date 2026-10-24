import { describe, it, expect } from 'vitest';
import { indentLines } from './noteIndent.js';

// Tab / Shift+Tab in a note: every line the selection touches moves by one
// level, and the selection moves with its text.

// "|" marks a caret, "[" and "]" a selection, in both input and expectation.
const run = (marked, outdent = false) => {
  const caret = marked.indexOf('|');
  let text; let start; let end;
  if (caret !== -1) {
    text = marked.replace('|', '');
    start = end = caret;
  } else {
    start = marked.indexOf('[');
    end = marked.indexOf(']') - 1;
    text = marked.replace('[', '').replace(']', '');
  }
  const r = indentLines(text, start, end, outdent);
  if (r.start === r.end) return r.text.slice(0, r.start) + '|' + r.text.slice(r.start);
  return r.text.slice(0, r.start) + '[' + r.text.slice(r.start, r.end) + ']' + r.text.slice(r.end);
};

describe('indentLines', () => {
  it('indents the caret line by two spaces and keeps the caret on its text', () => {
    expect(run('one\ntw|o\nthree')).toBe('one\n  tw|o\nthree');
  });

  it('indents a bullet into a sub-item', () => {
    expect(run('- a\n- b|')).toBe('- a\n  - b|');
  });

  it('indents every line a selection touches, and only those', () => {
    expect(run('x\n[a\nb]\ny')).toBe('x\n  [a\n  b]\ny');
    expect(run('x\na[a\nb]b\ny')).toBe('x\n  a[a\n  b]b\ny');
  });

  it('does not take the line a selection merely ends at the start of', () => {
    expect(run('[a\n]b')).toBe('  [a\n]b');
  });

  it('outdents by two spaces, one space or one tab', () => {
    expect(run('    de|ep', true)).toBe('  de|ep');
    expect(run(' o|ne', true)).toBe('o|ne');
    expect(run('\tt|ab', true)).toBe('t|ab');
  });

  it('outdents nothing on a line without indentation', () => {
    expect(run('fl|at', true)).toBe('fl|at');
  });

  it('keeps the caret on its line when outdenting past it', () => {
    // "  x" with the caret between its two spaces: both go, the caret stays at the line's start.
    expect(run(' | x', true)).toBe('|x');
  });

  it('outdents a mixed selection line by line', () => {
    expect(run('[  a\nb\n    c]', true)).toBe('[a\nb\n  c]');
  });

  it('handles the first and the last line of the note', () => {
    expect(run('|')).toBe('  |');
    expect(run('a\nb|')).toBe('a\n  b|');
  });
});
