// @vitest-environment node

import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createExternalEditVersionWatcher } from '../../../bridge/watch/fileWatcher';
import { intakeBridgeRequestToVault } from '../../../bridge/vault/intake';
import { listVersionSnapshots, type VersionSnapshot } from '../../../bridge/vault/versionStore';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), 'html-native-external-edit-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

function waitFor<T>(predicate: () => T | Promise<T | undefined> | undefined, timeoutMs = 1500): Promise<T> {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      void Promise.resolve(predicate()).then((result) => {
        if (result) {
          clearInterval(timer);
          resolve(result);
          return;
        }

        if (Date.now() - startedAt > timeoutMs) {
          clearInterval(timer);
          reject(new Error('Timed out waiting for external edit snapshot'));
        }
      });
    }, 25);
  });
}

async function sha256(filePath: string): Promise<string> {
  return `sha256:${createHash('sha256').update(await readFile(filePath)).digest('hex')}`;
}

describe('external edit version watcher', () => {
  it('creates an external edit version snapshot when a registered HTML file changes', async () => {
    const vaultDir = path.join(tempDir, 'Vault');
    const htmlPath = path.join(vaultDir, 'imports', 'agent-output.html');

    await mkdir(path.dirname(htmlPath), { recursive: true });
    await writeFile(htmlPath, '<!doctype html><title>Baseline</title><main>Alpha</main>', 'utf8');
    const intake = await intakeBridgeRequestToVault({
      vaultDir,
      request: {
        type: 'registerHtmlAsset',
        requestId: 'watch_external_edit',
        createdAt: '2026-06-27T00:00:00.000Z',
        sourcePath: htmlPath,
        sourceHash: await sha256(htmlPath),
        title: 'Agent Output',
        tags: ['watcher'],
        sourceAgent: 'codex',
      },
    });
    const watcher = createExternalEditVersionWatcher({
      vaultDir,
      rootDir: path.dirname(htmlPath),
      settleMs: 20,
      pollMs: 40,
    });

    await watcher.start();

    try {
      await writeFile(htmlPath, '<!doctype html><title>Changed</title><main>Beta</main>', 'utf8');

      const snapshots = await waitFor<VersionSnapshot[]>(async () => {
        const current = await listVersionSnapshots(vaultDir, intake.asset.id);
        return current.length === 2 ? current : undefined;
      });

      expect(snapshots.map((snapshot) => snapshot.reason)).toEqual(['baseline', 'external-agent-edit']);
    } finally {
      await watcher.stop();
    }
  });
});
