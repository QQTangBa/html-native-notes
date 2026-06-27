import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../..');

function read(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('native desktop publish command contract', () => {
  it('declares a Rust publish core that packages static HTML before invoking a provider', () => {
    const corePath = path.join(projectRoot, 'src-tauri/src/core/publish.rs');

    expect(existsSync(corePath)).toBe(true);

    const source = read('src-tauri/src/core/publish.rs');
    expect(source).toContain('pub fn publish_vault_static');
    expect(source).toContain('export_vault_static_package');
    expect(source).toContain('StaticPublishResult');
    expect(source).toContain('PublishProviderConfig');
    expect(source).toContain('fn load_publish_provider_config');
  });

  it('keeps provider execution user-configured and redacts command failure details', () => {
    const source = read('src-tauri/src/core/publish.rs');

    expect(source).toContain('PUBLISH_PROVIDER_MODE');
    expect(source).toContain('PUBLISH_COMMAND');
    expect(source).toContain('PUBLISH_COMMAND_ARGS');
    expect(source).toContain('PUBLISH_REQUIRED_ENV');
    expect(source).toContain('HTML_NATIVE_NOTES_PACKAGE_DIR');
    expect(source).toContain('HTML_NATIVE_NOTES_PUBLISH_MANIFEST');
    expect(source).toContain('HTML_NATIVE_NOTES_ASSET_ID');
    expect(source).toContain('Publish provider command failed');
    expect(source).not.toContain('stderr');
  });

  it('registers the native publish Tauri command used by the renderer desktop bridge', () => {
    const commandPath = path.join(projectRoot, 'src-tauri/src/commands/publish.rs');

    expect(existsSync(commandPath)).toBe(true);

    const commandSource = read('src-tauri/src/commands/publish.rs');
    expect(commandSource).toContain('pub async fn publish_static');
    expect(commandSource).toContain('State');

    const commandsMod = read('src-tauri/src/commands/mod.rs');
    const coreMod = read('src-tauri/src/core/mod.rs');
    const mainSource = read('src-tauri/src/main.rs');

    expect(commandsMod).toContain('pub mod publish');
    expect(coreMod).toContain('pub mod publish');
    expect(mainSource).toContain('commands::publish::publish_static');
  });
});
