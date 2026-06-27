import type { FastifyInstance } from 'fastify';
import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { scanHtmlAssetIntegrity } from '../../../bridge/assets/scanner';
import { readVaultAssetSource } from '../../../bridge/vault/source';
import type { AppConfig } from '../../shared/types';

const assetParamsSchema = z.object({
  assetId: z.string().regex(/^asset_[A-Za-z0-9_-]+$/, 'Invalid asset id'),
});

function httpError(message: string, statusCode: number): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}

function isInside(parentPath: string, childPath: string, allowEqual = false): boolean {
  const relative = path.relative(parentPath, childPath);
  return (allowEqual && relative === '') || Boolean(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

async function assertExistingFileInsideVault(vaultDir: string, filePath: string): Promise<void> {
  const [vaultRealPath, fileRealPath] = await Promise.all([realpath(vaultDir), realpath(filePath)]);
  if (!isInside(vaultRealPath, fileRealPath)) {
    throw httpError('Asset scan target must stay inside the configured Vault', 400);
  }
}

export async function registerAssetRoutes(app: FastifyInstance, config: AppConfig): Promise<void> {
  app.get('/api/assets/:assetId/integrity', async (request) => {
    const params = assetParamsSchema.parse(request.params);
    const source = await readVaultAssetSource({
      vaultDir: config.vaultDir,
      assetId: params.assetId,
    });

    await assertExistingFileInsideVault(config.vaultDir, source.sourcePath);

    return scanHtmlAssetIntegrity({ htmlPath: source.sourcePath });
  });
}
