import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../..');

function read(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('native desktop Vault command contract', () => {
  it('declares a Rust Vault core for manifest library listing and source reading', () => {
    const corePath = path.join(projectRoot, 'src-tauri/src/core/vault.rs');

    expect(existsSync(corePath)).toBe(true);

    const source = read('src-tauri/src/core/vault.rs');
    expect(source).toContain('pub fn list_vault_library');
    expect(source).toContain('pub fn read_vault_asset_source');
    expect(source).toContain('pub fn read_vault_manifest');
    expect(source).toContain('relative_source_path');
    expect(source).toContain('source_hash_matches');
    expect(source).toContain('sha256:');
  });

  it('registers native Vault Tauri commands used by the renderer desktop bridge', () => {
    const commandPath = path.join(projectRoot, 'src-tauri/src/commands/vault.rs');

    expect(existsSync(commandPath)).toBe(true);

    const commandSource = read('src-tauri/src/commands/vault.rs');
    expect(commandSource).toContain('pub async fn vault_list_library');
    expect(commandSource).toContain('pub async fn vault_get_asset_source');
    expect(commandSource).toContain('State');

    const mainSource = read('src-tauri/src/main.rs');
    expect(mainSource).toContain('commands::vault::vault_list_library');
    expect(mainSource).toContain('commands::vault::vault_get_asset_source');
  });
});
