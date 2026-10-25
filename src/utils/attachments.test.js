import { describe, it, expect } from 'vitest';
import {
  kindOf, normalizeAttachment, attachmentsOf, withAttachments, formatSize, referencedAttachmentIds,
} from './attachments.js';
import { fitWithin } from './imageResize.js';
import { setAttachmentBackend, readAttachmentFile, writeAttachmentFile, deleteAttachmentFile } from './attachmentStore.js';
import { createMemoryKeyValue } from './idbKeyValue.js';

const A = { id: 'a1', name: 'Beleg.pdf', mime: 'application/pdf', kind: 'pdf', size: 1234 };

describe('attachments', () => {
  it('knows images, PDFs and audio, by type or by extension', () => {
    expect(kindOf('image/jpeg')).toBe('image');
    expect(kindOf('application/pdf')).toBe('pdf');
    expect(kindOf('audio/mp4')).toBe('audio');
    expect(kindOf('', 'Sprachnotiz.m4a')).toBe('audio');
    expect(kindOf('', 'scan.PDF')).toBe('pdf');
    expect(kindOf('application/msword', 'brief.docx')).toBeNull();
    expect(kindOf('text/plain')).toBeNull();
  });

  it('keeps a valid entry and drops the rest', () => {
    expect(normalizeAttachment({ ...A, extra: 1 })).toEqual(A);
    expect(normalizeAttachment({ id: 'x', name: 'a.docx', mime: 'application/msword' })).toBeNull();
    expect(normalizeAttachment({ name: 'a.pdf', mime: 'application/pdf' })).toBeNull();
    expect(normalizeAttachment({ id: 'x', name: 'foto.jpg', size: -1 })).toMatchObject({ kind: 'image', size: 0 });
    expect(attachmentsOf({ attachments: [A, null, { id: '' }] })).toEqual([A]);
    expect(attachmentsOf({})).toEqual([]);
  });

  it('withAttachments writes the list, removes an empty one, and leaves an unloaded one alone', () => {
    expect(withAttachments({ id: 't' }, [A])).toEqual({ id: 't', attachments: [A] });
    expect(withAttachments({ id: 't', attachments: [A] }, [])).toEqual({ id: 't' });
    expect(withAttachments({ id: 't', attachments: [A] }, undefined)).toEqual({ id: 't', attachments: [A] });
  });

  it('formats sizes in the user\'s language', () => {
    expect(formatSize(512, 'de')).toBe('512 B');
    expect(formatSize(820 * 1024, 'de')).toBe('820 KB');
    expect(formatSize(1.5 * 1024 * 1024, 'de')).toBe('1,5 MB');
    expect(formatSize(1.5 * 1024 * 1024, 'en')).toBe('1.5 MB');
  });

  it('collects the ids every task still refers to', () => {
    const ids = referencedAttachmentIds([{ attachments: [A] }], [{ attachments: [{ ...A, id: 'a2' }] }, {}]);
    expect([...ids].sort()).toEqual(['a1', 'a2']);
  });

  it('fits a photo inside the long edge, never upscaling', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1500, height: 2000 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('stores, reads and deletes a file on this device', async () => {
    setAttachmentBackend(createMemoryKeyValue());
    expect(await readAttachmentFile('a1')).toBeNull();
    await writeAttachmentFile('a1', { mime: 'application/pdf', data: 'SGFsbG8=' });
    expect(await readAttachmentFile('a1')).toEqual({ mime: 'application/pdf', data: 'SGFsbG8=' });
    await deleteAttachmentFile('a1');
    expect(await readAttachmentFile('a1')).toBeNull();
  });
});
