// @vitest-environment node

import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { intakeBridgeRequestToVault, readVaultManifest } from '../../../bridge/vault/intake';

let tempDir: string;
let vaultDir: string;
let sourcePath: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), 'html-native-vault-intake-'));
  vaultDir = path.join(tempDir, 'Vault');
  sourcePath = path.join(tempDir, 'agent-output.html');
  await writeFile(sourcePath, '<!doctype html><title>Agent Output</title><h1>Hello</h1>', 'utf8');
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function sha256(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

describe('bridge vault intake', () => {
  it('registers an HTML bridge request into a Vault manifest without modifying the source file', async () => {
    const beforeHash = await sha256(sourcePath);

    const intake = await intakeBridgeRequestToVault({
      vaultDir,
      request: {
        requestId: 'vault-html-001',
        type: 'registerHtmlAsset',
        createdAt: '2026-06-26T12:00:00.000Z',
        sourcePath,
        sourceHash: beforeHash,
        title: 'Agent Output',
        tags: ['AI', ' vault '],
        sourceAgent: 'codex',
      },
    });

    const afterHash = await sha256(sourcePath);
    expect(afterHash).toBe(beforeHash);
    expect(intake.asset).toMatchObject({
      title: 'Agent Output',
      sourcePath,
      sourceHash: beforeHash,
      source: 'bridge',
      tags: ['ai', 'vault'],
    });
    expect(intake.manifestPath).toBe(path.join(vaultDir, '.htmlvault', 'manifest.json'));

    const manifest = await readVaultManifest(vaultDir);
    expect(manifest.assets).toHaveLength(1);
    expect(manifest.assets[0]).toMatchObject({
      id: intake.asset.id,
      sourcePath,
      sourceHash: beforeHash,
    });
  });

  it('rejects source hash mismatches and leaves the manifest unchanged', async () => {
    await expect(
      intakeBridgeRequestToVault({
        vaultDir,
        request: {
          requestId: 'vault-html-bad-hash',
          type: 'registerHtmlAsset',
          createdAt: '2026-06-26T12:00:00.000Z',
          sourcePath,
          sourceHash: 'sha256:not-the-real-hash',
        },
      }),
    ).rejects.toThrow('Source hash mismatch');

    const manifest = await readVaultManifest(vaultDir);
    expect(manifest.assets).toHaveLength(0);
  });

  it('deduplicates repeat requests by dedupe key', async () => {
    const sourceHash = await sha256(sourcePath);
    const request = {
      requestId: 'vault-html-dupe-001',
      type: 'registerHtmlAsset' as const,
      createdAt: '2026-06-26T12:00:00.000Z',
      sourcePath,
      sourceHash,
      title: 'Deduped',
    };

    const first = await intakeBridgeRequestToVault({ vaultDir, request });
    const second = await intakeBridgeRequestToVault({
      vaultDir,
      request: { ...request, requestId: 'vault-html-dupe-002' },
    });

    expect(second.asset.id).toBe(first.asset.id);
    expect(second.created).toBe(false);

    const manifest = await readVaultManifest(vaultDir);
    expect(manifest.assets).toHaveLength(1);
  });
});
