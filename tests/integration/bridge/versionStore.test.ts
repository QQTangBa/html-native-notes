// @vitest-environment node

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createVersionSnapshot,
  diffVersionSnapshots,
  listVersionSnapshots,
  rollbackToSnapshot,
} from '../../../bridge/vault/versionStore';

let tempDir: string;
let vaultDir: string;
let managedPath: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), 'html-native-version-'));
  vaultDir = path.join(tempDir, 'Vault');
  managedPath = path.join(tempDir, 'managed.html');
  await writeFile(managedPath, '<!doctype html><title>V1</title><main><h1>Hello</h1><p>Alpha</p></main>', 'utf8');
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('Vault version store', () => {
  it('creates and lists baseline snapshots for a managed asset', async () => {
    const snapshot = await createVersionSnapshot({
      vaultDir,
      assetId: 'asset_test',
      sourcePath: managedPath,
      reason: 'baseline',
    });

    expect(snapshot).toMatchObject({
      assetId: 'asset_test',
      reason: 'baseline',
      contentHash: expect.stringMatching(/^sha256:/),
    });
    expect(snapshot.snapshotId).toMatch(/^snap_/);

    const snapshots = await listVersionSnapshots(vaultDir, 'asset_test');
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.snapshotId).toBe(snapshot.snapshotId);
  });

  it('diffs source, readable content, and DOM summary between snapshots', async () => {
    const first = await createVersionSnapshot({
      vaultDir,
      assetId: 'asset_test',
      sourcePath: managedPath,
      reason: 'baseline',
    });

    await writeFile(
      managedPath,
      '<!doctype html><title>V2</title><main><h1>Hello</h1><p>Beta</p><section>New section</section></main>',
      'utf8',
    );

    const second = await createVersionSnapshot({
      vaultDir,
      assetId: 'asset_test',
      sourcePath: managedPath,
      reason: 'external-agent-edit',
    });

    const diff = await diffVersionSnapshots({
      vaultDir,
      assetId: 'asset_test',
      fromSnapshotId: first.snapshotId,
      toSnapshotId: second.snapshotId,
    });

    expect(diff.source.added).toContain('<p>Beta</p>');
    expect(diff.source.removed).toContain('<p>Alpha</p>');
    expect(diff.content.added).toContain('Beta');
    expect(diff.content.removed).toContain('Alpha');
    expect(diff.domSummary.addedTags).toContain('section');
    expect(diff.domSummary.changedTitle).toEqual({ from: 'V1', to: 'V2' });
  });

  it('rolls back a managed HTML copy to an earlier snapshot', async () => {
    const first = await createVersionSnapshot({
      vaultDir,
      assetId: 'asset_test',
      sourcePath: managedPath,
      reason: 'baseline',
    });

    await writeFile(managedPath, '<!doctype html><title>V2</title><main><h1>Changed</h1></main>', 'utf8');
    await createVersionSnapshot({
      vaultDir,
      assetId: 'asset_test',
      sourcePath: managedPath,
      reason: 'external-agent-edit',
    });

    const rollback = await rollbackToSnapshot({
      vaultDir,
      assetId: 'asset_test',
      snapshotId: first.snapshotId,
      targetPath: managedPath,
    });

    expect(rollback.restoredHash).toBe(first.contentHash);
    expect(await readFile(managedPath, 'utf8')).toContain('<p>Alpha</p>');
  });
});
