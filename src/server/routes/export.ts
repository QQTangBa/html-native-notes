import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { exportVaultAssetMarkdown, exportVaultAssetStaticPackage } from '../../../bridge/exporter/staticPackage';
import type { AppConfig } from '../../shared/types';

const exportParamsSchema = z.object({
  assetId: z.string().regex(/^asset_[A-Za-z0-9_-]+$/, 'Invalid asset id'),
});

export async function registerExportRoutes(app: FastifyInstance, config: AppConfig): Promise<void> {
  app.post('/api/export/:assetId/package', async (request) => {
    const params = exportParamsSchema.parse(request.params);
    return exportVaultAssetStaticPackage({
      vaultDir: config.vaultDir,
      assetId: params.assetId,
    });
  });

  app.post('/api/export/:assetId/markdown', async (request) => {
    const params = exportParamsSchema.parse(request.params);
    return exportVaultAssetMarkdown({
      vaultDir: config.vaultDir,
      assetId: params.assetId,
    });
  });
}
