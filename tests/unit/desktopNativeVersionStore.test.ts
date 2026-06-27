import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../..');

function read(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('native desktop Version Engine command contract', () => {
  it('declares a Rust Version Engine core for snapshots, diffs, and rollback', () => {
    const corePath = path.join(projectRoot, 'src-tauri/src/core/version_store.rs');

    expect(existsSync(corePath)).toBe(true);

    const source = read('src-tauri/src/core/version_store.rs');
    expect(source).toContain('pub fn list_vault_versions');
    expect(source).toContain('pub fn create_vault_version_snapshot');
    expect(source).toContain('pub fn diff_vault_versions');
    expect(source).toContain('pub fn rollback_vault_version');
    expect(source).toContain('fn line_diff');
    expect(source).toContain('fn dom_summary');
    expect(source).toContain('fn content_hash');
  });

  it('keeps version paths and asset IDs inside the native Vault boundary', () => {
    const source = read('src-tauri/src/core/version_store.rs');

    expect(source).toContain('fn assert_safe_asset_id');
    expect(source).toContain('Invalid asset id');
    expect(source).toContain('fn read_snapshot_content');
    expect(source).toContain('Snapshot content path is outside the asset version directory');
    expect(source).toContain('Source path escapes Vault');
    expect(source).toContain('canonicalize');
  });

  it('registers native Version Engine Tauri commands used by the renderer desktop bridge', () => {
    const commandPath = path.join(projectRoot, 'src-tauri/src/commands/version_store.rs');

    expect(existsSync(commandPath)).toBe(true);

    const commandSource = read('src-tauri/src/commands/version_store.rs');
    expect(commandSource).toContain('pub async fn vault_list_versions');
    expect(commandSource).toContain('pub async fn vault_create_version_snapshot');
    expect(commandSource).toContain('pub async fn vault_diff_versions');
    expect(commandSource).toContain('pub async fn vault_rollback_version');
    expect(commandSource).toContain('State');

    const mainSource = read('src-tauri/src/main.rs');
    expect(mainSource).toContain('commands::version_store::vault_list_versions');
    expect(mainSource).toContain('commands::version_store::vault_create_version_snapshot');
    expect(mainSource).toContain('commands::version_store::vault_diff_versions');
    expect(mainSource).toContain('commands::version_store::vault_rollback_version');
  });
});
