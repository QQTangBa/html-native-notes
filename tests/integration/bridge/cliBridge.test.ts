// @vitest-environment node

import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(__dirname, '../../..');
const cliPath = path.join(projectRoot, 'bridge/cli/index.ts');

async function runCli(args: string[]) {
  const result = await execFileAsync('npx', ['tsx', cliPath, ...args], {
    cwd: projectRoot,
    env: { ...process.env, NO_COLOR: '1' },
  });

  return JSON.parse(result.stdout) as Record<string, unknown>;
}

describe('agent bridge CLI fallback', () => {
  it('registers HTML assets as JSON for scriptable agent fallback', async () => {
    const result = await runCli([
      'register',
      '--file',
      '/Users/example/work/report.html',
      '--request-id',
      'cli-html-001',
      '--source-hash',
      'sha256:cli123',
      '--title',
      'CLI Report',
      '--tag',
      'AI',
      '--tag',
      ' report ',
      '--source-agent',
      'codex',
    ]);

    expect(result).toMatchObject({
      ok: true,
      type: 'registerHtmlAsset',
      requestId: 'cli-html-001',
      dedupeKey: 'registerHtmlAsset:sha256:cli123',
    });
    expect(result.normalized).toMatchObject({
      tags: ['ai', 'report'],
      sourceAgent: 'codex',
    });
  });

  it('registers web services as JSON for scriptable agent fallback', async () => {
    const result = await runCli([
      'service',
      'register',
      '--request-id',
      'cli-service-001',
      '--title',
      'CLI Dashboard',
      '--cwd',
      '/Users/example/dashboard',
      '--start',
      'npm run dev',
      '--url',
      'http://127.0.0.1:5173',
      '--port',
      '5173',
    ]);

    expect(result).toMatchObject({
      ok: true,
      type: 'registerWebService',
      requestId: 'cli-service-001',
      dedupeKey: 'registerWebService:cli-service-001',
    });
    expect(result.normalized).toMatchObject({
      service: {
        title: 'CLI Dashboard',
        startCommand: 'npm run dev',
      },
    });
  });

  it('exits non-zero for invalid asset registrations', async () => {
    await expect(
      execFileAsync('npx', ['tsx', cliPath, 'register', '--file', '/tmp/report.pdf'], {
        cwd: projectRoot,
        env: { ...process.env, NO_COLOR: '1' },
      }),
    ).rejects.toMatchObject({
      code: 1,
    });
  });
});
