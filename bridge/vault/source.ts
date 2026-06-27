import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { readVaultManifest } from './intake';

export interface VaultAssetSource {
  assetId: string;
  title: string;
  sourcePath: string;
  sourceHash?: string;
  currentHash: string;
  sourceHashMatches: boolean;
  html: string;
}

export interface ReadVaultAssetSourceOptions {
  vaultDir: string;
  assetId: string;
}

function httpError(message: string, statusCode: number): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}

function sha256(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

export async function readVaultAssetSource(options: ReadVaultAssetSourceOptions): Promise<VaultAssetSource> {
  const manifest = await readVaultManifest(options.vaultDir);
  const asset = manifest.assets.find((item) => item.id === options.assetId);

  if (!asset) {
    throw httpError(`Vault asset not found: ${options.assetId}`, 404);
  }

  if (asset.kind !== 'html-note' || !asset.sourcePath) {
    throw httpError(`Vault asset is not a previewable HTML note: ${options.assetId}`, 400);
  }

  const html = await readFile(asset.sourcePath, 'utf8');
  const currentHash = sha256(html);

  return {
    assetId: asset.id,
    title: asset.title,
    sourcePath: asset.sourcePath,
    sourceHash: asset.sourceHash,
    currentHash,
    sourceHashMatches: asset.sourceHash ? asset.sourceHash === currentHash : true,
    html,
  };
}
