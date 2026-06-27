import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../..');

function read(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('native desktop export command contract', () => {
  it('declares a Rust exporter core for static package and Markdown export', () => {
    const corePath = path.join(projectRoot, 'src-tauri/src/core/exporter.rs');

    expect(existsSync(corePath)).toBe(true);

    const source = read('src-tauri/src/core/exporter.rs');
    expect(source).toContain('pub fn export_vault_static_package');
    expect(source).toContain('pub fn export_vault_markdown');
    expect(source).toContain('fn collect_references');
    expect(source).toContain('fn copy_local_reference');
    expect(source).toContain('fn html_to_markdown');
    expect(source).toContain('StaticPackageExportResult');
    expect(source).toContain('MarkdownExportResult');
  });

  it('keeps native export writes inside the managed Vault export boundary', () => {
    const source = read('src-tauri/src/core/exporter.rs');

    expect(source).toContain('.htmlvault');
    expect(source).toContain('exports');
    expect(source).toContain('latest');
    expect(source).toContain('manifest.json');
    expect(source).toContain('fn is_inside');
    expect(source).toContain('skipped_external');
    expect(source).toContain('source_hash');
  });

  it('registers native export Tauri commands used by the renderer desktop bridge', () => {
    const commandPath = path.join(projectRoot, 'src-tauri/src/commands/exporter.rs');

    expect(existsSync(commandPath)).toBe(true);

    const commandSource = read('src-tauri/src/commands/exporter.rs');
    expect(commandSource).toContain('pub async fn export_static_package');
    expect(commandSource).toContain('pub async fn export_markdown');
    expect(commandSource).toContain('State');

    const mainSource = read('src-tauri/src/main.rs');
    expect(mainSource).toContain('commands::exporter::export_static_package');
    expect(mainSource).toContain('commands::exporter::export_markdown');
  });
});
