import { describe, it, expect } from 'vitest';
import { readSharedFile } from './useSharedFilesToNotes.js';
import { SHARE_CHUNK_BYTES } from '../utils/sharedFilesNote.js';

describe('readSharedFile', () => {
  it('joins the pieces into the whole file', () => {
    const bytes = new Uint8Array(SHARE_CHUNK_BYTES * 2 + 10).map((_, i) => i % 251);
    const b64 = (u8) => Buffer.from(u8).toString('base64');
    const read = (id, offset, length) => (offset >= bytes.length ? '' : b64(bytes.subarray(offset, offset + length)));
    expect(readSharedFile('x', read)).toBe(b64(bytes));
  });

  it('a file of exactly one piece needs no second read past it', () => {
    const bytes = new Uint8Array(SHARE_CHUNK_BYTES).fill(7);
    let calls = 0;
    const read = (id, offset, length) => { calls += 1; return offset >= bytes.length ? '' : Buffer.from(bytes.subarray(offset, offset + length)).toString('base64'); };
    expect(readSharedFile('x', read)).toBe(Buffer.from(bytes).toString('base64'));
    expect(calls).toBe(2);
  });

  it('an unreadable file is empty', () => {
    expect(readSharedFile('gone', () => '')).toBe('');
  });
});
