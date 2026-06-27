import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../..');

function read(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('native desktop service runtime command contract', () => {
  it('declares a Rust service runtime core for registry-backed health, start, and stop', () => {
    const corePath = path.join(projectRoot, 'src-tauri/src/core/service_runtime.rs');

    expect(existsSync(corePath)).toBe(true);

    const source = read('src-tauri/src/core/service_runtime.rs');
    expect(source).toContain('pub fn check_service_health');
    expect(source).toContain('pub fn start_service');
    expect(source).toContain('pub fn stop_service');
    expect(source).toContain('fn read_service_registry');
    expect(source).toContain('fn service_id_for_asset');
    expect(source).toContain('RegisteredWebService');
    expect(source).toContain('ServiceRuntimeResult');
  });

  it('preserves the PRD service fields and failure evidence in the native runtime source', () => {
    const source = read('src-tauri/src/core/service_runtime.rs');

    expect(source).toContain('start_command');
    expect(source).toContain('stop_command');
    expect(source).toContain('health_check_url');
    expect(source).toContain('env_hints');
    expect(source).toContain('log_path');
    expect(source).toContain('cwd');
    expect(source).toContain('failed');
    expect(source).toContain('/bin/zsh');
  });

  it('registers native service Tauri commands used by the renderer desktop bridge', () => {
    const commandPath = path.join(projectRoot, 'src-tauri/src/commands/service_runtime.rs');

    expect(existsSync(commandPath)).toBe(true);

    const commandSource = read('src-tauri/src/commands/service_runtime.rs');
    expect(commandSource).toContain('pub async fn service_check_health');
    expect(commandSource).toContain('pub async fn service_start');
    expect(commandSource).toContain('pub async fn service_stop');
    expect(commandSource).toContain('State');

    const mainSource = read('src-tauri/src/main.rs');
    expect(mainSource).toContain('commands::service_runtime::service_check_health');
    expect(mainSource).toContain('commands::service_runtime::service_start');
    expect(mainSource).toContain('commands::service_runtime::service_stop');
  });
});
