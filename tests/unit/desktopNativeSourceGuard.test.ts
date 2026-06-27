import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../..');

function read(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('native desktop Source Guard command contract', () => {
  it('declares a Rust Source Guard core for review, diff, and explicit write decisions', () => {
    const corePath = path.join(projectRoot, 'src-tauri/src/core/source_guard.rs');

    expect(existsSync(corePath)).toBe(true);

    const source = read('src-tauri/src/core/source_guard.rs');
    expect(source).toContain('pub fn review_vault_asset_write');
    expect(source).toContain('pub fn apply_vault_write_decision');
    expect(source).toContain('fn create_readable_diff');
    expect(source).toContain('fn hash_file');
    expect(source).toContain('Source changed before write-back');
    expect(source).toContain('save-as');
    expect(source).toContain('write-back');
  });

  it('keeps native Source Guard writes inside the configured Vault boundary', () => {
    const source = read('src-tauri/src/core/source_guard.rs');

    expect(source).toContain('fn ensure_existing_vault_path');
    expect(source).toContain('fn prepare_vault_save_as_path');
    expect(source).toContain('canonicalize');
    expect(source).toContain('Source path escapes Vault');
    expect(source).toContain('Save-as path escapes Vault');
    expect(source).toContain('Save-as target already exists');
  });

  it('registers native Source Guard Tauri commands used by the renderer desktop bridge', () => {
    const commandPath = path.join(projectRoot, 'src-tauri/src/commands/source_guard.rs');

    expect(existsSync(commandPath)).toBe(true);

    const commandSource = read('src-tauri/src/commands/source_guard.rs');
    expect(commandSource).toContain('pub async fn source_guard_review_write');
    expect(commandSource).toContain('pub async fn source_guard_apply_write_decision');
    expect(commandSource).toContain('State');

    const mainSource = read('src-tauri/src/main.rs');
    expect(mainSource).toContain('commands::source_guard::source_guard_review_write');
    expect(mainSource).toContain('commands::source_guard::source_guard_apply_write_decision');
  });
});
