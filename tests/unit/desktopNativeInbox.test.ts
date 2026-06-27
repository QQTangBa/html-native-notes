import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../..');

function read(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('native desktop inbox command contract', () => {
  it('declares a Rust inbox core that can read, ack, and intake requests without touching source HTML', () => {
    const corePath = path.join(projectRoot, 'src-tauri/src/core/inbox.rs');

    expect(existsSync(corePath)).toBe(true);

    const source = read('src-tauri/src/core/inbox.rs');
    expect(source).toContain('pub fn read_inbox_requests');
    expect(source).toContain('pub fn acknowledge_inbox_requests');
    expect(source).toContain('pub fn intake_inbox_request');
    expect(source).toContain('.htmlvault');
    expect(source).toContain('requests.jsonl');
    expect(source).toContain('source_hash');
  });

  it('registers native inbox Tauri commands that match the renderer desktop bridge', () => {
    const commandPath = path.join(projectRoot, 'src-tauri/src/commands/inbox.rs');

    expect(existsSync(commandPath)).toBe(true);

    const commandSource = read('src-tauri/src/commands/inbox.rs');
    expect(commandSource).toContain('pub async fn inbox_list_requests');
    expect(commandSource).toContain('pub async fn inbox_confirm_request');
    expect(commandSource).toContain('pub async fn inbox_dismiss_request');
    expect(commandSource).toContain('AppHandle');
    expect(commandSource).toContain('State');

    const libSource = read('src-tauri/src/lib.rs');
    expect(libSource).toContain('mod commands');
    expect(libSource).toContain('mod core');
    expect(libSource).toContain('commands::inbox::inbox_list_requests');
    expect(libSource).toContain('commands::inbox::inbox_confirm_request');
    expect(libSource).toContain('commands::inbox::inbox_dismiss_request');
  });
});
