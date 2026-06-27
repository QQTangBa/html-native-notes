// @vitest-environment node

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createHtmlAssetWatcher,
  scanExistingHtmlAssets,
} from '../../../bridge/watch/fileWatcher';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), 'html-native-watch-'));
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
          reject(new Error('Timed out waiting for watcher result'));
        }
      });
    }, 25);
  });
}

describe('agent bridge file watcher', () => {
  it('scans existing HTML assets into normalized register requests', async () => {
    const htmlPath = path.join(tempDir, 'existing.html');
    const ignoredPath = path.join(tempDir, 'notes.md');

    await writeFile(htmlPath, '<!doctype html><title>Existing</title>', 'utf8');
    await writeFile(ignoredPath, '# ignored markdown', 'utf8');

    const requests = await scanExistingHtmlAssets({
      rootDir: tempDir,
      sourceAgent: 'file-watcher',
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      type: 'registerHtmlAsset',
      sourcePath: htmlPath,
      sourceAgent: 'file-watcher',
      title: 'existing.html',
    });
    expect(requests[0]?.requestId).toMatch(/^watch:/);
    expect(requests[0]?.sourceHash).toMatch(/^sha256:/);
    expect(requests[0]?.dedupeKey).toBe(`registerHtmlAsset:${requests[0]?.sourceHash}`);
  });

  it('emits a normalized register request when a new HTML file appears', async () => {
    const emitted: Array<{ sourcePath?: string; sourceHash?: string; requestId: string }> = [];
    const watcher = createHtmlAssetWatcher({
      rootDir: tempDir,
      sourceAgent: 'file-watcher',
      settleMs: 20,
      onRequest: (request) => {
        emitted.push(request);
      },
    });

    await watcher.start();

    try {
      const htmlPath = path.join(tempDir, 'new-report.html');
      await writeFile(htmlPath, '<!doctype html><title>New</title>', 'utf8');

      const request = await waitFor(() => emitted.find((item) => item.sourcePath === htmlPath));

      expect(request.requestId).toMatch(/^watch:/);
      expect(request.sourceHash).toMatch(/^sha256:/);
    } finally {
      await watcher.stop();
    }
  });

  it('ignores non-HTML files and duplicate file events for the same content hash', async () => {
    const htmlPath = path.join(tempDir, 'stable.html');
    const emitted: string[] = [];
    const watcher = createHtmlAssetWatcher({
      rootDir: tempDir,
      sourceAgent: 'file-watcher',
      settleMs: 20,
      onRequest: (request) => {
        emitted.push(request.dedupeKey);
      },
    });

    await watcher.start();

    try {
      await writeFile(path.join(tempDir, 'ignored.txt'), 'ignored', 'utf8');
      await writeFile(htmlPath, '<h1>Stable</h1>', 'utf8');
      await waitFor(() => emitted[0]);
      await writeFile(htmlPath, '<h1>Stable</h1>', 'utf8');

      await new Promise((resolve) => setTimeout(resolve, 120));

      expect(emitted).toHaveLength(1);
    } finally {
      await watcher.stop();
    }
  });

});
