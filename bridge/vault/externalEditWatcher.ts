import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { readVaultManifest } from './intake';
import { createVersionSnapshot, listVersionSnapshots, type VersionSnapshot } from './versionStore';

export interface ExternalEditSnapshotResult {
  created: VersionSnapshot[];
  skipped: Array<{
    assetId: string;
    reason: 'not-html' | 'missing-source' | 'unchanged';
  }>;
}

async function hashFile(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

export async function snapshotExternalVaultEdits(options: { vaultDir: string }): Promise<ExternalEditSnapshotResult> {
  const manifest = await readVaultManifest(options.vaultDir);
  const created: VersionSnapshot[] = [];
  const skipped: ExternalEditSnapshotResult['skipped'] = [];

  for (const asset of manifest.assets) {
    if (asset.kind !== 'html-note') {
      skipped.push({ assetId: asset.id, reason: 'not-html' });
      continue;
    }

    if (!asset.sourcePath) {
      skipped.push({ assetId: asset.id, reason: 'missing-source' });
      continue;
    }

    const [currentHash, snapshots] = await Promise.all([hashFile(asset.sourcePath), listVersionSnapshots(options.vaultDir, asset.id)]);
    const latestSnapshot = snapshots.at(-1);

    if (latestSnapshot?.contentHash === currentHash) {
      skipped.push({ assetId: asset.id, reason: 'unchanged' });
      continue;
    }

    created.push(
      await createVersionSnapshot({
        vaultDir: options.vaultDir,
        assetId: asset.id,
        sourcePath: asset.sourcePath,
        reason: 'external-agent-edit',
      }),
    );
  }

  return { created, skipped };
}
