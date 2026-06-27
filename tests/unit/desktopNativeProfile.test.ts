import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../..');

function read(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('native desktop HTML Profile command contract', () => {
  it('declares a Rust profile core for build, embed, extract, and migration', () => {
    const corePath = path.join(projectRoot, 'src-tauri/src/core/profile.rs');

    expect(existsSync(corePath)).toBe(true);

    const source = read('src-tauri/src/core/profile.rs');
    expect(source).toContain('pub fn build_html_profile');
    expect(source).toContain('pub fn embed_html_profile');
    expect(source).toContain('pub fn extract_embedded_html_profile');
    expect(source).toContain('pub fn migrate_html_profile');
    expect(source).toContain('HtmlProfile');
  });

  it('covers metadata, assets, blocks, AI context, theme vars, and source hashes', () => {
    const source = read('src-tauri/src/core/profile.rs');

    expect(source).toContain('schema_version');
    expect(source).toContain('profile_version');
    expect(source).toContain('source_hash');
    expect(source).toContain('assets');
    expect(source).toContain('blocks');
    expect(source).toContain('ai_context');
    expect(source).toContain('theme_vars');
    expect(source).toContain('data-ainote-block-id');
    expect(source).toContain('ainote-profile');
  });

  it('registers native profile Tauri commands for future editor persistence', () => {
    const commandPath = path.join(projectRoot, 'src-tauri/src/commands/profile.rs');

    expect(existsSync(commandPath)).toBe(true);

    const commandSource = read('src-tauri/src/commands/profile.rs');
    expect(commandSource).toContain('pub async fn profile_build');
    expect(commandSource).toContain('pub async fn profile_embed');
    expect(commandSource).toContain('pub async fn profile_extract');
    expect(commandSource).toContain('pub async fn profile_migrate');

    const commandsMod = read('src-tauri/src/commands/mod.rs');
    const coreMod = read('src-tauri/src/core/mod.rs');
    const libSource = read('src-tauri/src/lib.rs');

    expect(commandsMod).toContain('pub mod profile');
    expect(coreMod).toContain('pub mod profile');
    expect(libSource).toContain('commands::profile::profile_build');
    expect(libSource).toContain('commands::profile::profile_embed');
    expect(libSource).toContain('commands::profile::profile_extract');
    expect(libSource).toContain('commands::profile::profile_migrate');
  });
});
