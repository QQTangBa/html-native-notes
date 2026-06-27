// @vitest-environment node

import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { publishVaultAssetStatic } from '../../../bridge/publish/staticProvider';
import { intakeBridgeRequestToVault } from '../../../bridge/vault/intake';

let tempDir: string;

function sha256(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

async function createHtmlAsset(vaultDir: string) {
  const sourceDir = path.join(vaultDir, 'imports', 'publish');
  const htmlPath = path.join(sourceDir, 'publishable.html');
  const html = '<!doctype html><html><head><title>Publishable</title></head><body><h1>Ready</h1></body></html>';
  await mkdir(sourceDir, { recursive: true });
  await writeFile(htmlPath, html, 'utf8');

  return intakeBridgeRequestToVault({
    vaultDir,
    request: {
      requestId: 'req_publish_static',
      type: 'registerHtmlAsset',
      createdAt: '2026-06-27T00:00:00.000Z',
      sourceAgent: 'codex',
      sourcePath: htmlPath,
      sourceHash: sha256(html),
      title: 'Publishable',
    },
  });
}

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), 'html-native-publish-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('static publish provider adapter', () => {
  it('packages a Vault HTML asset and publishes it through a configured command provider', async () => {
    const vaultDir = path.join(tempDir, 'vault');
    const intake = await createHtmlAsset(vaultDir);
    const scriptPath = path.join(tempDir, 'fixture-publisher.mjs');
    await writeFile(
      scriptPath,
      [
        "import { readFile } from 'node:fs/promises';",
        "const manifest = JSON.parse(await readFile(process.env.HTML_NATIVE_NOTES_PUBLISH_MANIFEST, 'utf8'));",
        "if (!process.env.HTML_NATIVE_NOTES_PACKAGE_DIR.endsWith('/latest')) throw new Error('missing package dir');",
        "console.log(JSON.stringify({ publicUrl: `https://notes.example.com/${manifest.assetId}/` }));",
      ].join('\n'),
      'utf8',
    );

    const result = await publishVaultAssetStatic({
      vaultDir,
      assetId: intake.asset.id,
      provider: {
        mode: 'command',
        command: process.execPath,
        args: [scriptPath],
        requiredEnv: [],
      },
    });

    expect(result).toMatchObject({
      assetId: intake.asset.id,
      publishType: 'static-provider',
      provider: 'command',
      publicUrl: `https://notes.example.com/${intake.asset.id}/`,
    });
    expect(await readFile(result.package.indexPath, 'utf8')).toContain('<h1>Ready</h1>');
  });

  it('rejects unconfigured providers before publishing', async () => {
    const vaultDir = path.join(tempDir, 'vault');
    const intake = await createHtmlAsset(vaultDir);

    await expect(
      publishVaultAssetStatic({
        vaultDir,
        assetId: intake.asset.id,
        provider: { mode: 'disabled' },
      }),
    ).rejects.toThrow(/Publish provider is not configured/);
  });

  it('redacts provider secrets from command failure details', async () => {
    const vaultDir = path.join(tempDir, 'vault');
    const intake = await createHtmlAsset(vaultDir);
    const secret = 'fixture-publish-secret-value';
    const scriptPath = path.join(tempDir, 'leaky-publisher.mjs');
    await writeFile(
      scriptPath,
      [
        "console.error(`provider failed with ${process.env.PUBLISH_TOKEN}`);",
        'process.exit(1);',
      ].join('\n'),
      'utf8',
    );

    await expect(
      publishVaultAssetStatic({
        vaultDir,
        assetId: intake.asset.id,
        provider: {
          mode: 'command',
          command: process.execPath,
          args: [scriptPath],
          requiredEnv: ['PUBLISH_TOKEN'],
          env: { PUBLISH_TOKEN: secret },
        },
      }),
    ).rejects.toThrow(/Publish provider command failed/);

    await expect(
      publishVaultAssetStatic({
        vaultDir,
        assetId: intake.asset.id,
        provider: {
          mode: 'command',
          command: process.execPath,
          args: [scriptPath],
          requiredEnv: ['PUBLISH_TOKEN'],
          env: { PUBLISH_TOKEN: secret },
        },
      }),
    ).rejects.not.toThrow(secret);
  });
});
