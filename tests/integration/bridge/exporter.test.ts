// @vitest-environment node

import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { exportVaultAssetMarkdown, exportVaultAssetStaticPackage } from '../../../bridge/exporter/staticPackage';
import { intakeBridgeRequestToVault } from '../../../bridge/vault/intake';

let tempDir: string;

function sha256(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), 'html-native-exporter-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('Vault exporter and local publish package', () => {
  it('exports a static package with HTML, local assets, manifest, and unchanged source hash', async () => {
    const vaultDir = path.join(tempDir, 'vault');
    const sourceDir = path.join(vaultDir, 'imports', 'daily');
    const assetDir = path.join(sourceDir, 'assets');
    await mkdir(assetDir, { recursive: true });
    await writeFile(path.join(assetDir, 'style.css'), 'body{color:#123}', 'utf8');
    await writeFile(path.join(assetDir, 'cover.png'), 'fake-image', 'utf8');
    const html = [
      '<!doctype html><html><head><title>Daily Review</title>',
      '<link rel="stylesheet" href="assets/style.css">',
      '<link rel="stylesheet" href="https://cdn.example.com/remote.css">',
      '</head><body><article><h1>Daily Review</h1><p>Done.</p><img src="assets/cover.png"></article></body></html>',
    ].join('');
    const htmlPath = path.join(sourceDir, 'daily.html');
    await writeFile(htmlPath, html, 'utf8');
    const intake = await intakeBridgeRequestToVault({
      vaultDir,
      request: {
        requestId: 'req_daily_export',
        type: 'registerHtmlAsset',
        createdAt: '2026-06-27T00:00:00.000Z',
        sourceAgent: 'codex',
        sourcePath: htmlPath,
        sourceHash: sha256(html),
        title: 'Daily Review',
      },
    });

    const result = await exportVaultAssetStaticPackage({ vaultDir, assetId: intake.asset.id });

    expect(result.indexPath).toBe(path.join(result.outputDir, 'index.html'));
    expect(result.copiedAssets.map((asset) => asset.reference).sort()).toEqual(['assets/cover.png', 'assets/style.css']);
    expect(result.skippedExternal).toEqual([{ kind: 'stylesheet', reference: 'https://cdn.example.com/remote.css' }]);
    expect(JSON.parse(await readFile(result.manifestPath, 'utf8'))).toMatchObject({
      assetId: intake.asset.id,
      title: 'Daily Review',
      exportType: 'static-package',
    });
    expect(await readFile(result.indexPath, 'utf8')).toBe(html);
    expect((await stat(path.join(result.outputDir, 'assets', 'style.css'))).size).toBeGreaterThan(0);
    expect(sha256(await readFile(htmlPath, 'utf8'))).toBe(sha256(html));
  });

  it('exports a readable Markdown copy from an HTML asset', async () => {
    const vaultDir = path.join(tempDir, 'vault');
    const sourceDir = path.join(vaultDir, 'imports', 'journal');
    await mkdir(sourceDir, { recursive: true });
    const html = '<html><body><article><h1>Journal</h1><p>First line.</p><ul><li>One</li><li>Two</li></ul></article></body></html>';
    const htmlPath = path.join(sourceDir, 'journal.html');
    await writeFile(htmlPath, html, 'utf8');
    const intake = await intakeBridgeRequestToVault({
      vaultDir,
      request: {
        requestId: 'req_markdown_export',
        type: 'registerHtmlAsset',
        createdAt: '2026-06-27T00:00:00.000Z',
        sourceAgent: 'codex',
        sourcePath: htmlPath,
        sourceHash: sha256(html),
        title: 'Journal',
      },
    });

    const result = await exportVaultAssetMarkdown({ vaultDir, assetId: intake.asset.id });

    expect(result.outputPath).toMatch(/Journal\.md$/);
    expect(await readFile(result.outputPath, 'utf8')).toContain('# Journal');
    expect(await readFile(result.outputPath, 'utf8')).toContain('- One');
    expect(sha256(await readFile(htmlPath, 'utf8'))).toBe(sha256(html));
  });
});
