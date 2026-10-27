import { describe, it, expect } from 'vitest';
import { noteTextForShare, attachableFiles, noteIdForShare, SHARE_CHUNK_BYTES } from './sharedFilesNote.js';

describe('a share becomes a note', () => {
  it('takes the subject as title, else the first file name, else the fallback', () => {
    expect(noteTextForShare({ subject: 'Rechnung Oktober', text: 'Bitte bis 15. zahlen', files: [{ name: 'scan.pdf' }] }, 'Geteilt'))
      .toEqual({ title: 'Rechnung Oktober', notes: 'Bitte bis 15. zahlen' });
    expect(noteTextForShare({ files: [{ name: 'IMG_2041.jpg' }, { name: 'b.jpg' }] }, 'Geteilt'))
      .toEqual({ title: 'IMG_2041', notes: '' });
    expect(noteTextForShare({ files: [] }, 'Geteilt')).toEqual({ title: 'Geteilt', notes: '' });
  });

  it('text shared alone: the first line is the title, the rest the text', () => {
    expect(noteTextForShare({ text: 'Einkauf\n- Milch\n- Brot', files: [] }, 'Geteilt'))
      .toEqual({ title: 'Einkauf', notes: '- Milch\n- Brot' });
    expect(noteTextForShare({ text: '# Ideen\n\nmehr', files: [] }, 'Geteilt')).toEqual({ title: 'Ideen', notes: 'mehr' });
    expect(noteTextForShare({ text: 'nur eine Zeile', files: [] }, 'Geteilt')).toEqual({ title: 'nur eine Zeile', notes: '' });
    const long = 'x'.repeat(200);
    expect(noteTextForShare({ text: `${long}\nb`, files: [] }, 'Geteilt')).toEqual({ title: 'Geteilt', notes: `${long}\nb` });
  });

  it('a subject stays the title of shared text', () => {
    expect(noteTextForShare({ subject: 'Rezept', text: 'Mehl\nZucker', files: [] }, 'x')).toEqual({ title: 'Rezept', notes: 'Mehl\nZucker' });
  });

  it('does not repeat the subject as text', () => {
    expect(noteTextForShare({ subject: 'Foto', text: 'Foto', files: [] }, 'x')).toEqual({ title: 'Foto', notes: '' });
  });

  it('keeps only files it can attach', () => {
    const files = [
      { id: 'a', name: 'a.jpg', mime: 'image/jpeg' },
      { id: 'b', name: 'b.docx', mime: 'application/msword' },
      { id: '', name: 'c.pdf', mime: 'application/pdf' },
      { id: 'd', name: 'd.m4a', mime: '' },
    ];
    expect(attachableFiles({ files }).map((f) => f.id)).toEqual(['a', 'd']);
  });

  it('keys the note by the share, and reads in whole base64 groups', () => {
    expect(noteIdForShare('b1')).toBe('share-b1');
    expect(SHARE_CHUNK_BYTES % 3).toBe(0);
  });
});
