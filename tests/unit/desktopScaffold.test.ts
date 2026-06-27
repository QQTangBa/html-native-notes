import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../..');

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(projectRoot, relativePath), 'utf8')) as T;
}

describe('desktop app scaffold contract', () => {
  it('declares Tauri desktop scripts in package.json', () => {
    const packageJson = readJson<{ scripts: Record<string, string> }>('package.json');

    expect(packageJson.scripts['tauri:dev']).toBe('tauri dev');
    expect(packageJson.scripts['tauri:build']).toBe('tauri build');
    expect(packageJson.scripts['test:desktop:contract']).toBe(
      'vitest run tests/unit/desktopScaffold.test.ts tests/unit/desktopNativeInbox.test.ts',
    );
  });

  it('has a Tauri configuration for a macOS desktop app', () => {
    const tauriConfig = readJson<{
      productName: string;
      identifier: string;
      app: { windows: Array<{ title: string }> };
      bundle: { active: boolean; targets: string[]; macOS: { minimumSystemVersion: string } };
    }>('src-tauri/tauri.conf.json');

    expect(tauriConfig.productName).toBe('HTML Native Notes');
    expect(tauriConfig.identifier).toBe('com.htmlvault.html-native-notes');
    expect(tauriConfig.app.windows[0]?.title).toBe('HTML Native Notes');
    expect(tauriConfig.bundle.active).toBe(true);
    expect(tauriConfig.bundle.targets).toContain('app');
    expect(tauriConfig.bundle.macOS.minimumSystemVersion).toBe('10.13');
  });

  it('contains the Rust desktop entrypoint and command boundary', () => {
    const mainPath = path.join(projectRoot, 'src-tauri/src/main.rs');

    expect(existsSync(mainPath)).toBe(true);

    const mainSource = readFileSync(mainPath, 'utf8');
    expect(mainSource).toContain('#[tauri::command]');
    expect(mainSource).toContain('fn app_health()');
    expect(mainSource).toContain('HTML Native Notes desktop shell');
  });

  it('documents that the current target is a PRD desktop app, not the old web prototype', () => {
    const readme = readFileSync(path.join(projectRoot, 'README.md'), 'utf8');

    expect(readme).toContain('PRD desktop reset in progress');
    expect(readme).toContain('macOS desktop AI HTML Vault app');
    expect(readme).toContain('not the complete product');
  });
});
