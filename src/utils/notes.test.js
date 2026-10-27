import { describe, it, expect } from 'vitest';
import { isNote, toNote, fromNote, stripNote, noteExcerpt, sortNotes } from './notes.js';
import { notBucketed } from './bucketList.js';
import { toInboxCopy } from './inboxMove.js';

const NOW = '2026-11-01T10:00:00.000Z';

describe('notes', () => {
  it('an Inbox entry becomes a note and back, keeping what it is', () => {
    const task = { id: 'a', title: 'Ideen', color: 'bg-blue-500', notes: 'x', subtasks: [{ id: 's' }], deadline: '2026-11-03', priority: 2, reminders: [{ id: 'r' }] };
    const note = toNote(task, NOW);
    expect(note).toEqual({ id: 'a', title: 'Ideen', color: 'bg-blue-500', notes: 'x', subtasks: [{ id: 's' }], reminders: [{ id: 'r' }], isNote: true, lastModified: NOW });
    expect(isNote(note)).toBe(true);
    const back = fromNote(note, NOW);
    expect(back.isNote).toBeUndefined();
    expect(back.priority).toBe(0);
    expect(back.notes).toBe('x');
  });

  it('a Bucket item made a note leaves the Bucket', () => {
    expect(toNote({ id: 'a', bucketId: 'b1' }, NOW).bucketId).toBeUndefined();
  });

  it('the Inbox leaves notes out, through the one exclusion it applies everywhere', () => {
    expect(notBucketed({ id: 'a' })).toBe(true);
    expect(notBucketed({ id: 'a', isNote: true })).toBe(false);
    expect(notBucketed({ id: 'a', bucketId: 'b1' })).toBe(false);
  });

  it('an entry sent to the Inbox from the timeline is never a note', () => {
    expect(toInboxCopy({ id: 'a', date: '2026-11-01', startTime: '10:00', isNote: true }, NOW).isNote).toBeUndefined();
    expect(stripNote({ id: 'a', isNote: true, title: 't' })).toEqual({ id: 'a', title: 't' });
  });

  it('takes the first lines for the card, with their formatting', () => {
    // The card shows the formatting, so the marks stay.
    expect(noteExcerpt('**Fett** und ~~weg~~\n\n- [ ] Milch\n- Brot\n## Titel\nmehr\nnoch mehr'))
      .toBe('**Fett** und ~~weg~~\n\n- [ ] Milch\n- Brot\n## Titel\nmehr');
    expect(noteExcerpt('\n\n\na\n\n\n\nb', 5)).toBe('a\n\nb');
    expect(noteExcerpt('')).toBe('');
    expect(noteExcerpt(undefined)).toBe('');
  });

  it('closes a code block the cut leaves open', () => {
    expect(noteExcerpt('Code:\n```\nx = 1\ny = 2\nz = 3\nw = 4', 3)).toBe('Code:\n```\nx = 1\n```');
    expect(noteExcerpt('```\nx\n```\nok', 5)).toBe('```\nx\n```\nok');
  });

  it('sorts the most recently changed first', () => {
    const list = [{ id: 'a', lastModified: '2026-01-01' }, { id: 'b', lastModified: '2026-03-01' }, { id: 'c', createdAt: '2026-02-01' }];
    expect(sortNotes(list).map((n) => n.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('pinned notes', () => {
  it('lead the list, each group newest first', () => {
    const list = [
      { id: 'a', lastModified: '2026-03-01' },
      { id: 'b', lastModified: '2026-01-01', pinned: true },
      { id: 'c', lastModified: '2026-04-01' },
      { id: 'd', lastModified: '2026-02-01', pinned: true },
    ];
    expect(sortNotes(list).map((n) => n.id)).toEqual(['d', 'b', 'c', 'a']);
  });

  it('the pin goes with the note flag, wherever the note leaves to', () => {
    expect(fromNote({ id: 'a', isNote: true, pinned: true }, NOW).pinned).toBeUndefined();
    expect(stripNote({ id: 'a', isNote: true, pinned: true })).toEqual({ id: 'a' });
    expect(toInboxCopy({ id: 'a', isNote: true, pinned: true, date: '2026-11-01' }, NOW).pinned).toBeUndefined();
  });
});
