import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../..');

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(projectRoot, relativePath), 'utf8')) as T;
}

describe('desktop app scaffold contract', () => {
  it('declares Tauri desktop scripts in package.json', () => {
    const packageJson = readJson<{ scripts: Record<string, string>; devDependencies: Record<string, string> }>('package.json');

    expect(packageJson.scripts['tauri:dev']).toBe('tauri dev');
    expect(packageJson.scripts['tauri:build']).toBe('tauri build');
    expect(packageJson.devDependencies['@tauri-apps/cli']).toBeDefined();
    expect(packageJson.scripts['test:desktop:contract']).toBe(
      'vitest run tests/unit/desktopScaffold.test.ts tests/unit/desktopNativeInbox.test.ts tests/unit/desktopNativeVault.test.ts tests/unit/desktopNativeSourceGuard.test.ts tests/unit/desktopNativeVersionStore.test.ts tests/unit/desktopNativeImporter.test.ts tests/unit/desktopNativeProfile.test.ts tests/unit/desktopNativeAssetScan.test.ts tests/unit/desktopNativeServiceRuntime.test.ts tests/unit/desktopNativeExporter.test.ts tests/unit/desktopNativePublish.test.ts tests/unit/desktopNativeNotes.test.ts',
    );
  });

  it('has a Tauri configuration for a macOS desktop app', () => {
    const tauriConfig = readJson<{
      productName: string;
      identifier: string;
      build: { devUrl: string };
      app: { withGlobalTauri: boolean; windows: Array<{ title: string }> };
      bundle: { active: boolean; targets: string[]; macOS: { minimumSystemVersion: string } };
    }>('src-tauri/tauri.conf.json');

    expect(tauriConfig.productName).toBe('HTML Native Notes');
    expect(tauriConfig.identifier).toBe('com.htmlvault.html-native-notes');
    expect(tauriConfig.build.devUrl).toBe('http://127.0.0.1:5178');
    expect(tauriConfig.app.withGlobalTauri).toBe(true);
    expect(tauriConfig.app.windows[0]?.title).toBe('HTML Native Notes');
    expect(tauriConfig.bundle.active).toBe(true);
    expect(tauriConfig.bundle.targets).toContain('app');
    expect(tauriConfig.bundle.macOS.minimumSystemVersion).toBe('10.13');
    expect(existsSync(path.join(projectRoot, 'src-tauri/icons/icon.png'))).toBe(true);
  });

  it('builds frontend assets with relative paths for the embedded desktop protocol', () => {
    const viteConfig = readFileSync(path.join(projectRoot, 'vite.config.ts'), 'utf8');

    expect(viteConfig).toContain("base: './'");
  });

  it('contains the Rust desktop entrypoint and command boundary', () => {
    const mainPath = path.join(projectRoot, 'src-tauri/src/main.rs');
    const libPath = path.join(projectRoot, 'src-tauri/src/lib.rs');

    expect(existsSync(mainPath)).toBe(true);
    expect(existsSync(libPath)).toBe(true);

    const mainSource = readFileSync(mainPath, 'utf8');
    const libSource = readFileSync(libPath, 'utf8');

    expect(mainSource).toContain('html_native_notes_lib::run()');
    expect(libSource).toContain('use tauri::Manager');
    expect(libSource).toContain('#[tauri::command]');
    expect(libSource).toContain('fn app_health()');
    expect(libSource).toContain('HTML Native Notes desktop shell');
  });

  it('documents the current open-source desktop app scope and setup', () => {
    const readme = readFileSync(path.join(projectRoot, 'README.md'), 'utf8');

    expect(readme).toContain('Local-first macOS desktop app');
    expect(readme).toContain('Obsidian-style left Vault tree');
    expect(readme).toContain('English / Chinese UI switch');
    expect(readme).toContain('Dark / light theme switch');
    expect(readme).toContain('开源仓库只上传源码、文档、配置模板和测试，不上传打包产物');
  });
});
