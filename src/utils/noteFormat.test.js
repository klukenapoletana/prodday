import { describe, it, expect } from 'vitest';
import { applyNoteFormat, NOTE_FORMATS } from './noteFormat.js';

// The text with the selection drawn in: [ and ] around a selection, | for a
// caret, so each case reads as before → after.
const parse = (marked) => {
  const caret = marked.indexOf('|');
  if (caret !== -1) return { text: marked.replace('|', ''), start: caret, end: caret };
  const start = marked.indexOf('[');
  const end = marked.indexOf(']') - 1;
  return { text: marked.replace('[', '').replace(']', ''), start, end };
};
const show = ({ text, start, end }) => (start === end
  ? text.slice(0, start) + '|' + text.slice(start)
  : text.slice(0, start) + '[' + text.slice(start, end) + ']' + text.slice(end));
const fmt = (marked, kind) => {
  const { text, start, end } = parse(marked);
  return show(applyNoteFormat(text, start, end, kind));
};

describe('inline marks', () => {
  it('a bare caret gets a pair, the caret between it', () => {
    expect(fmt('Hallo |', 'bold')).toBe('Hallo **|**');
    expect(fmt('|', 'italic')).toBe('*|*');
    expect(fmt('a |b', 'underline')).toBe('a __|__b');
    expect(fmt('|', 'strike')).toBe('~~|~~');
    expect(fmt('|', 'code')).toBe('`|`');
  });

  it('pressed again on an empty pair, takes it off', () => {
    expect(fmt('Hallo **|**', 'bold')).toBe('Hallo |');
  });

  it('wraps the selection and keeps it selected', () => {
    expect(fmt('ein [Wort] hier', 'bold')).toBe('ein **[Wort]** hier');
    expect(fmt('[ganzer Satz]', 'strike')).toBe('~~[ganzer Satz]~~');
  });

  it('leaves a trailing or leading space outside the mark', () => {
    expect(fmt('ein [Wort ]hier', 'bold')).toBe('ein **[Wort]** hier');
    expect(fmt('[ Wort]', 'italic')).toBe(' *[Wort]*');
  });

  it('takes the mark off marked text, selected inside or with it', () => {
    expect(fmt('ein **[Wort]** hier', 'bold')).toBe('ein [Wort] hier');
    expect(fmt('ein [**Wort**] hier', 'bold')).toBe('ein [Wort] hier');
    expect(fmt('[~~weg~~]', 'strike')).toBe('[weg]');
  });

  it('italic and bold are told apart', () => {
    expect(fmt('**[fett]**', 'italic')).toBe('***[fett]***');
    expect(fmt('*[kursiv]*', 'italic')).toBe('[kursiv]');
  });

  it('marks each line of a selection over several lines', () => {
    expect(fmt('[eins\nzwei\n\ndrei]', 'bold')).toBe('[**eins**\n**zwei**\n\n**drei**]');
    expect(fmt('[**eins**\n**zwei**]', 'bold')).toBe('[eins\nzwei]');
    expect(fmt('  [eins \nzwei]', 'italic')).toBe('[  *eins* \n*zwei*]');
  });
});

describe('line formats', () => {
  it('puts the prefix at the start of the caret line, after its indent', () => {
    expect(fmt('Einkauf|', 'heading')).toBe('# Einkauf|');
    expect(fmt('Milch|', 'bullet')).toBe('- Milch|');
    expect(fmt('  Milch|', 'checklist')).toBe('  - [ ] Milch|');
    expect(fmt('|', 'bullet')).toBe('- |');
  });

  it('takes it off again, and swaps one line format for another', () => {
    expect(fmt('# Einkauf|', 'heading')).toBe('Einkauf|');
    expect(fmt('- Milch|', 'checklist')).toBe('- [ ] Milch|');
    expect(fmt('- [x] Milch|', 'bullet')).toBe('- Milch|');
    expect(fmt('- [ ] Milch|', 'checklist')).toBe('Milch|');
  });

  it('a caret in the old prefix lands after the new one', () => {
    expect(fmt('|- Milch', 'checklist')).toBe('- [ ] |Milch');
  });

  it('formats every non-empty line a selection touches', () => {
    expect(fmt('a\n[Milch\n\nBrot]\nz', 'bullet')).toBe('a\n- [Milch\n\n- Brot]\nz');
    expect(fmt('[- Milch\n- Brot]', 'bullet')).toBe('[Milch\nBrot]');
    expect(fmt('[- Milch\nBrot]', 'bullet')).toBe('- [Milch\n- Brot]');
  });
});

describe('indent, outdent and code block', () => {
  it('indents and outdents the touched lines', () => {
    expect(fmt('- Milch|', 'indent')).toBe('  - Milch|');
    expect(fmt('  - Milch|', 'outdent')).toBe('- Milch|');
  });

  it('fences the selection on lines of its own', () => {
    expect(fmt('Code: [x = 1]', 'codeblock')).toBe('Code: \n```\n[x = 1]\n```');
    expect(fmt('|', 'codeblock')).toBe('```\n|\n```');
  });
});

describe('every button does something', () => {
  it('none is a no-op on a plain word', () => {
    for (const kind of NOTE_FORMATS) {
      const r = applyNoteFormat('  Wort', 2, 6, kind);
      expect(r.text, kind).not.toBe('  Wort');
    }
  });
});
