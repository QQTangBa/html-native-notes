import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileNoteStore } from '../../src/server/storage/noteStore';

let tempDir: string;
let store: FileNoteStore;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), 'html-native-notes-'));
  store = new FileNoteStore(tempDir);
  await store.init();
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('FileNoteStore', () => {
  it('creates metadata and a standalone HTML note file', async () => {
    const note = await store.createNote({
      title: 'AI HTML 笔记',
      content: '<!doctype html><html><body><h1>Hello</h1></body></html>',
      tags: ['ai', 'html'],
    });

    expect(note.id).toMatch(/^note_/);
    expect(note.title).toBe('AI HTML 笔记');
    expect(note.archived).toBe(false);
    expect(note.tags).toEqual(['ai', 'html']);

    const saved = await readFile(path.join(tempDir, 'notes', note.fileName), 'utf8');
    expect(saved).toContain('<h1>Hello</h1>');

    const listed = await store.listNotes();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(note.id);
  });

  it('updates note content and updatedAt without changing createdAt', async () => {
    const note = await store.createNote({ title: 'Draft' });

    await new Promise((resolve) => setTimeout(resolve, 5));
    const updated = await store.saveNoteContent(note.id, '<html><body><p>Changed</p></body></html>');

    expect(updated.createdAt).toBe(note.createdAt);
    expect(Date.parse(updated.updatedAt)).toBeGreaterThan(Date.parse(note.updatedAt));

    const record = await store.getNote(note.id);
    expect(record.content).toContain('Changed');
  });

  it('hydrates wikilinks, tags, and backlinks from saved HTML notes', async () => {
    const alpha = await store.createNote({
      title: 'Alpha',
      content: '<article><h1>Alpha</h1><span data-tag="research">#research</span></article>',
      tags: ['seed'],
    });
    const beta = await store.createNote({
      title: 'Beta',
      content: '<article><p>Connects to <a data-wikilink="Alpha" href="alpha.html">Alpha</a> for #market work.</p></article>',
    });

    const listed = await store.listNotes();
    const alphaMeta = listed.find((note) => note.id === alpha.id);
    const betaMeta = listed.find((note) => note.id === beta.id);

    expect(alphaMeta?.tags).toEqual(['seed', 'research']);
    expect(alphaMeta?.backlinks).toEqual(['Beta']);
    expect(betaMeta?.tags).toEqual(['market']);
    expect(betaMeta?.wikilinks).toEqual(['Alpha']);

    const betaRecord = await store.getNote(beta.id);
    expect(betaRecord.wikilinks).toEqual(['Alpha']);
    expect(betaRecord.backlinks).toEqual([]);
  });

  it('duplicates notes with a new id, filename, and title', async () => {
    const note = await store.createNote({ title: 'Original', content: '<h1>Original</h1>' });
    const copy = await store.duplicateNote(note.id);

    expect(copy.id).not.toBe(note.id);
    expect(copy.fileName).not.toBe(note.fileName);
    expect(copy.title).toBe('Original copy');
    expect((await store.getNote(copy.id)).content).toContain('Original');
  });

  it('serializes concurrent creates without losing metadata entries', async () => {
    const created = await Promise.all(
      Array.from({ length: 5 }, (_item, index) => store.createNote({ title: `Concurrent ${index}` })),
    );

    const listed = await store.listNotes();

    expect(listed.map((item) => item.id).sort()).toEqual(created.map((item) => item.id).sort());
  });

  it('archives notes to trash when deleted', async () => {
    const note = await store.createNote({ title: 'Delete me', content: '<p>temporary</p>' });

    await store.deleteNote(note.id);

    await expect(store.getNote(note.id)).rejects.toThrow(/Note not found/);
    const trashFile = await readFile(path.join(tempDir, 'trash', note.fileName), 'utf8');
    expect(trashFile).toContain('temporary');
    expect(await store.listNotes()).toHaveLength(0);
  });

  it('rejects path traversal identifiers', async () => {
    await expect(store.getNote('../metadata')).rejects.toThrow(/Invalid note id/);
    await expect(store.saveNoteContent('note_/evil', '<p>x</p>')).rejects.toThrow(/Invalid note id/);
    await expect(store.deleteNote('note_../../evil')).rejects.toThrow(/Invalid note id/);
  });
});
