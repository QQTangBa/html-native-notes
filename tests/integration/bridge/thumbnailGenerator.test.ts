// @vitest-environment node

import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { intakeBridgeRequestToVault } from '../../../bridge/vault/intake';
import { buildVaultLibrary } from '../../../bridge/vault/library';
import { generateMissingVaultThumbnails } from '../../../bridge/vault/thumbnails';
import { createTempVault, sha256File } from './helpers/tempVault';

function sha256(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

describe('Vault thumbnail generation', () => {
  it('renders missing HTML thumbnails without changing the original source file', async () => {
    const fixture = await createTempVault('html-native-thumbnails-');
    try {
      const htmlDir = path.join(fixture.vaultDir, 'imports', 'ai');
      const htmlPath = path.join(htmlDir, 'thumbnail-source.html');
      const html = [
        '<!doctype html>',
        '<html>',
        '<head>',
        '  <title>Thumbnail Source</title>',
        '  <meta name="keywords" content="thumbnail, ai">',
        '  <style>body{margin:0;font-family:sans-serif;background:#14201c;color:#f5f0d8}section{padding:36px}h1{font-size:42px}</style>',
        '</head>',
        '<body><section><h1>Thumbnail Source</h1><p>Rendered by the Vault thumbnail worker.</p></section></body>',
        '</html>',
      ].join('\n');
      await mkdir(htmlDir, { recursive: true });
      await writeFile(htmlPath, html, 'utf8');
      const originalHash = await sha256File(htmlPath);

      const intake = await intakeBridgeRequestToVault({
        vaultDir: fixture.vaultDir,
        request: {
          requestId: 'req_thumbnail_source',
          type: 'registerHtmlAsset',
          createdAt: '2026-06-27T00:00:00.000Z',
          sourceAgent: 'codex',
          sourcePath: htmlPath,
          sourceHash: sha256(html),
          title: 'Thumbnail Source',
          tags: ['thumbnail'],
        },
      });

      const before = await buildVaultLibrary({ vaultDir: fixture.vaultDir });
      expect(before.items[0]?.thumbnail.status).toBe('pending');

      const result = await generateMissingVaultThumbnails({ vaultDir: fixture.vaultDir });

      expect(result.generated).toEqual([
        {
          assetId: intake.asset.id,
          path: path.join(fixture.vaultDir, '.htmlvault', 'thumbnails', `${intake.asset.id}.png`),
        },
      ]);
      expect((await stat(result.generated[0]!.path)).size).toBeGreaterThan(1000);
      expect((await readFile(result.generated[0]!.path)).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(await sha256File(htmlPath)).toBe(originalHash);

      const after = await buildVaultLibrary({ vaultDir: fixture.vaultDir });
      expect(after.items[0]?.thumbnail.status).toBe('ready');
    } finally {
      await fixture.cleanup();
    }
  });
});
