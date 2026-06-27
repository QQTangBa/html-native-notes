import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../..');

function read(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('native desktop importer command contract', () => {
  it('declares a Rust importer core for read-only existing project scans', () => {
    const corePath = path.join(projectRoot, 'src-tauri/src/core/importer.rs');

    expect(existsSync(corePath)).toBe(true);

    const source = read('src-tauri/src/core/importer.rs');
    expect(source).toContain('pub fn scan_import_candidates');
    expect(source).toContain('ImportCandidate');
    expect(source).toContain('ImportScanResult');
    expect(source).toContain('fn walk_import_root');
    expect(source).toContain('fn sha256_file');
  });

  it('covers PRD import candidates without mutating source directories', () => {
    const source = read('src-tauri/src/core/importer.rs');

    expect(source).toContain('html-note');
    expect(source).toContain('markdown-note');
    expect(source).toContain('service');
    expect(source).toContain('project');
    expect(source).toContain('package.json');
    expect(source).toContain('index.html');
    expect(source).toContain('source_hash');
    expect(source).toContain('fs::read');
    expect(source).not.toContain('fs::write');
    expect(source).not.toContain('fs::copy');
  });

  it('skips heavy/generated folders during native import scans', () => {
    const source = read('src-tauri/src/core/importer.rs');

    expect(source).toContain('node_modules');
    expect(source).toContain('.git');
    expect(source).toContain('.htmlvault');
    expect(source).toContain('dist');
    expect(source).toContain('target');
  });

  it('registers native import scan commands used by future desktop import UI', () => {
    const commandPath = path.join(projectRoot, 'src-tauri/src/commands/importer.rs');

    expect(existsSync(commandPath)).toBe(true);

    const commandSource = read('src-tauri/src/commands/importer.rs');
    expect(commandSource).toContain('pub async fn import_scan_candidates');
    expect(commandSource).toContain('State');

    const commandsMod = read('src-tauri/src/commands/mod.rs');
    const coreMod = read('src-tauri/src/core/mod.rs');
    const libSource = read('src-tauri/src/lib.rs');

    expect(commandsMod).toContain('pub mod importer');
    expect(coreMod).toContain('pub mod importer');
    expect(libSource).toContain('commands::importer::import_scan_candidates');
  });
});
