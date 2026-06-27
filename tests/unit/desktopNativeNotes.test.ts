import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../..');

function read(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('native desktop notes command contract', () => {
  it('declares a Rust note store core for HTML note CRUD', () => {
    const corePath = path.join(projectRoot, 'src-tauri/src/core/notes.rs');

    expect(existsSync(corePath)).toBe(true);

    const source = read('src-tauri/src/core/notes.rs');
    expect(source).toContain('pub fn list_notes');
    expect(source).toContain('pub fn create_note');
    expect(source).toContain('pub fn get_note');
    expect(source).toContain('pub fn save_note_content');
    expect(source).toContain('pub fn duplicate_note');
    expect(source).toContain('pub fn delete_note');
    expect(source).toContain('NoteMeta');
    expect(source).toContain('NoteRecord');
  });

  it('preserves local HTML note storage safety and graph metadata hooks', () => {
    const source = read('src-tauri/src/core/notes.rs');

    expect(source).toContain('metadata.json');
    expect(source).toContain('notes');
    expect(source).toContain('trash');
    expect(source).toContain('fn assert_valid_note_id');
    expect(source).toContain('Invalid note id');
    expect(source).toContain('fn extract_note_metadata');
    expect(source).toContain('wikilinks');
    expect(source).toContain('backlinks');
  });

  it('registers native note Tauri commands used by the renderer desktop bridge', () => {
    const commandPath = path.join(projectRoot, 'src-tauri/src/commands/notes.rs');

    expect(existsSync(commandPath)).toBe(true);

    const commandSource = read('src-tauri/src/commands/notes.rs');
    expect(commandSource).toContain('pub async fn note_list');
    expect(commandSource).toContain('pub async fn note_create');
    expect(commandSource).toContain('pub async fn note_get');
    expect(commandSource).toContain('pub async fn note_save_content');
    expect(commandSource).toContain('pub async fn note_duplicate');
    expect(commandSource).toContain('pub async fn note_delete');
    expect(commandSource).toContain('State');

    const libSource = read('src-tauri/src/lib.rs');
    expect(libSource).toContain('commands::notes::note_list');
    expect(libSource).toContain('commands::notes::note_create');
    expect(libSource).toContain('commands::notes::note_get');
    expect(libSource).toContain('commands::notes::note_save_content');
    expect(libSource).toContain('commands::notes::note_duplicate');
    expect(libSource).toContain('commands::notes::note_delete');
  });
});
