import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { readVaultManifest, type BridgeVaultAsset } from './intake';

export interface GeneratedThumbnail {
  assetId: string;
  path: string;
}

export interface ThumbnailGenerationResult {
  generated: GeneratedThumbnail[];
  skipped: Array<{
    assetId: string;
    reason: 'not-html' | 'missing-source' | 'already-exists';
  }>;
}

export interface GenerateVaultThumbnailsOptions {
  vaultDir: string;
  viewport?: {
    width: number;
    height: number;
  };
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function thumbnailPath(vaultDir: string, assetId: string): string {
  return path.join(vaultDir, '.htmlvault', 'thumbnails', `${assetId}.png`);
}

async function skipReasonFor(
  asset: BridgeVaultAsset,
  outputPath: string,
): Promise<ThumbnailGenerationResult['skipped'][number] | null> {
  if (asset.kind !== 'html-note') {
    return { assetId: asset.id, reason: 'not-html' };
  }

  if (!asset.sourcePath) {
    return { assetId: asset.id, reason: 'missing-source' };
  }

  if (await pathExists(outputPath)) {
    return { assetId: asset.id, reason: 'already-exists' };
  }

  return null;
}

export async function generateMissingVaultThumbnails(
  options: GenerateVaultThumbnailsOptions,
): Promise<ThumbnailGenerationResult> {
  const viewport = options.viewport ?? { width: 1024, height: 640 };
  const manifest = await readVaultManifest(options.vaultDir);
  const generated: GeneratedThumbnail[] = [];
  const skipped: ThumbnailGenerationResult['skipped'] = [];
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage({ viewport });

    for (const asset of manifest.assets) {
      const outputPath = thumbnailPath(options.vaultDir, asset.id);
      const skip = await skipReasonFor(asset, outputPath);
      if (skip) {
        skipped.push(skip);
        continue;
      }

      await mkdir(path.dirname(outputPath), { recursive: true });
      await page.goto(pathToFileURL(asset.sourcePath!).toString(), { waitUntil: 'load' });
      await page.screenshot({ path: outputPath, fullPage: false });
      generated.push({ assetId: asset.id, path: outputPath });
    }
  } finally {
    await browser.close();
  }

  return { generated, skipped };
}
