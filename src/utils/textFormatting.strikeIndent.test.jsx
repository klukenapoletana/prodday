import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderFormattedText, splitIndent } from './textFormatting.jsx';

// ~~Strikethrough~~ beside the other inline marks, and indentation (a tab or
// two spaces per level) on plain lines, bullets and checkboxes alike.

const html = (text) => renderToStaticMarkup(<div>{renderFormattedText(text)}</div>);

describe('strikethrough', () => {
  it('strikes the marked text and nothing around it', () => {
    expect(html('buy ~~milk~~ bread')).toContain('buy <s>milk</s> bread');
  });

  it('carries the other inline marks inside it', () => {
    expect(html('~~**done** and *gone*~~')).toContain('<s><strong>done</strong> and <em>gone</em></s>');
  });

  it('sits beside bold, italic and underline on one line', () => {
    const out = html('**b** *i* __u__ ~~s~~');
    expect(out).toContain('<strong>b</strong>');
    expect(out).toContain('<em>i</em>');
    expect(out).toContain('<span class="underline">u</span>');
    expect(out).toContain('<s>s</s>');
  });

  it('leaves a lone pair of tildes as typed', () => {
    expect(html('about ~~ 5 minutes')).toContain('about ~~ 5 minutes');
  });

  it('works inside a bullet and a checkbox', () => {
    expect(html('- ~~old idea~~')).toContain('<s>old idea</s>');
    expect(html('- [ ] ~~skip~~')).toContain('<s>skip</s>');
  });
});

describe('splitIndent', () => {
  it('counts two spaces or one tab as a level and strips them', () => {
    expect(splitIndent('text')).toEqual({ level: 0, rest: 'text' });
    expect(splitIndent(' text')).toEqual({ level: 0, rest: 'text' });
    expect(splitIndent('  text')).toEqual({ level: 1, rest: 'text' });
    expect(splitIndent('\ttext')).toEqual({ level: 1, rest: 'text' });
    expect(splitIndent('    - item')).toEqual({ level: 2, rest: '- item' });
    expect(splitIndent('\t  x')).toEqual({ level: 2, rest: 'x' });
  });
});

describe('indentation', () => {
  it('indents a plain line by padding, without its own spaces', () => {
    const out = html('top\n  inner\n    deeper');
    expect(out).toContain('<div>top</div>');
    expect(out).toContain('<div style="padding-left:1.25em">inner</div>');
    expect(out).toContain('<div style="padding-left:2.5em">deeper</div>');
  });

  it('indents bullets into sub-items', () => {
    const out = html('- fruit\n  - apple\n    - green');
    expect(out).toMatch(/<div class="flex items-start gap-1\.5 py-px"><span[^>]*><\/span><span>fruit<\/span>/);
    expect(out).toMatch(/style="padding-left:1\.25em"><span[^>]*><\/span><span>apple<\/span>/);
    expect(out).toMatch(/style="padding-left:2\.5em"><span[^>]*><\/span><span>green<\/span>/);
  });

  it('indents checkboxes, a tab being one level', () => {
    const rows = html('- [ ] pack\n\t- [x] socks').split('py-px').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('pack');
    expect(rows[0]).not.toContain('padding-left');
    expect(rows[1]).toContain('socks');
    expect(rows[1]).toMatch(/^"\s*style="padding-left:1\.25em"/);
  });

  it('still reads an indented "- " as a bullet, not as text', () => {
    expect(html('  - item')).not.toContain('- item');
  });

  it('leaves headings and blank lines as before', () => {
    const out = html('# Title\n\nbody');
    expect(out).toContain('text-lg font-bold');
    expect(out).toContain('<div class="h-1.5"></div>');
  });
});
