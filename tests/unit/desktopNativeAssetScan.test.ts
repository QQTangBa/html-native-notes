import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../..');

function read(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('native desktop asset integrity command contract', () => {
  it('declares a Rust asset scanner core for read-only HTML integrity checks', () => {
    const corePath = path.join(projectRoot, 'src-tauri/src/core/asset_scan.rs');

    expect(existsSync(corePath)).toBe(true);

    const source = read('src-tauri/src/core/asset_scan.rs');
    expect(source).toContain('pub fn scan_vault_asset_integrity');
    expect(source).toContain('fn collect_references');
    expect(source).toContain('fn collect_dangerous_scripts');
    expect(source).toContain('fn source_hash');
    expect(source).toContain('safe_mode_required');
  });

  it('keeps native asset scans read-only and inside the configured Vault boundary', () => {
    const source = read('src-tauri/src/core/asset_scan.rs');

    expect(source).toContain('Asset scan target must stay inside the configured Vault');
    expect(source).toContain('canonicalize');
    expect(source).not.toContain('fs::write');
  });

  it('registers the native asset scan Tauri command used by the renderer desktop bridge', () => {
    const commandPath = path.join(projectRoot, 'src-tauri/src/commands/asset_scan.rs');

    expect(existsSync(commandPath)).toBe(true);

    const commandSource = read('src-tauri/src/commands/asset_scan.rs');
    expect(commandSource).toContain('pub async fn asset_scan_integrity');
    expect(commandSource).toContain('State');

    const mainSource = read('src-tauri/src/main.rs');
    expect(mainSource).toContain('commands::asset_scan::asset_scan_integrity');
  });
});
