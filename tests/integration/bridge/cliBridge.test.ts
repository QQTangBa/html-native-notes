// @vitest-environment node

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { intakeBridgeRequestToVault } from '../../../bridge/vault/intake';
import { createTempVault } from './helpers/tempVault';

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

function sha256(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
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

  it('writes an offline inbox JSONL request when requested', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'html-native-cli-inbox-'));
    const inboxPath = path.join(tempDir, 'requests.jsonl');

    try {
      const result = await runCli([
        'register',
        '--file',
        '/Users/example/work/offline.html',
        '--request-id',
        'cli-inbox-001',
        '--source-hash',
        'sha256:cliinbox1',
        '--offline-inbox',
        inboxPath,
      ]);

      expect(result).toMatchObject({
        ok: true,
        inboxPath,
        requestId: 'cli-inbox-001',
        dedupeKey: 'registerHtmlAsset:sha256:cliinbox1',
      });

      const raw = await readFile(inboxPath, 'utf8');
      expect(JSON.parse(raw)).toMatchObject({
        requestId: 'cli-inbox-001',
        dedupeKey: 'registerHtmlAsset:sha256:cliinbox1',
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('generates missing Vault thumbnails from the CLI', async () => {
    const fixture = await createTempVault('html-native-cli-thumbnails-');

    try {
      const htmlDir = path.join(fixture.vaultDir, 'imports', 'ai');
      const htmlPath = path.join(htmlDir, 'cli-thumbnail.html');
      const html =
        '<html><head><title>CLI Thumbnail</title></head><body><main style="padding:48px;font-family:sans-serif"><h1>CLI Thumbnail</h1></main></body></html>';
      await mkdir(htmlDir, { recursive: true });
      await writeFile(htmlPath, html, 'utf8');

      const intake = await intakeBridgeRequestToVault({
        vaultDir: fixture.vaultDir,
        request: {
          requestId: 'cli-thumbnail-001',
          type: 'registerHtmlAsset',
          createdAt: '2026-06-27T00:00:00.000Z',
          sourceAgent: 'codex',
          sourcePath: htmlPath,
          sourceHash: sha256(html),
          title: 'CLI Thumbnail',
        },
      });

      const result = await runCli(['thumbnail', 'generate', '--vault-dir', fixture.vaultDir]);
      const expectedPath = path.join(fixture.vaultDir, '.htmlvault', 'thumbnails', `${intake.asset.id}.png`);

      expect(result).toMatchObject({
        ok: true,
        type: 'generateVaultThumbnails',
        generatedCount: 1,
        skippedCount: 0,
        generated: [{ assetId: intake.asset.id, path: expectedPath }],
      });
      expect((await stat(expectedPath)).size).toBeGreaterThan(1000);
    } finally {
      await fixture.cleanup();
    }
  });
});
