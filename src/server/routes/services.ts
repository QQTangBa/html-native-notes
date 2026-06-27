import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import { z } from 'zod';
import { createServiceRuntimeManager, readServiceRegistry } from '../../../bridge/service/runtime';
import { readVaultManifest } from '../../../bridge/vault/intake';
import type { AppConfig } from '../../shared/types';

const serviceAssetParamsSchema = z.object({
  assetId: z.string().regex(/^asset_[A-Za-z0-9_-]+$/, 'Invalid asset id'),
});

function httpError(message: string, statusCode: number): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}

function registryPathFor(vaultDir: string): string {
  return path.join(vaultDir, '.htmlvault', 'services.json');
}

async function serviceIdForAsset(vaultDir: string, assetId: string): Promise<string> {
  const manifest = await readVaultManifest(vaultDir);
  const asset = manifest.assets.find((item) => item.id === assetId);

  if (!asset) {
    throw httpError(`Vault asset not found: ${assetId}`, 404);
  }

  if (asset.kind !== 'service') {
    throw httpError(`Vault asset is not a service: ${assetId}`, 400);
  }

  const registry = await readServiceRegistry(registryPathFor(vaultDir));
  const service = registry.services.find((item) => item.id === assetId || item.cwd === asset.sourcePath);

  if (!service) {
    throw httpError(`Registered service not found for asset: ${assetId}`, 404);
  }

  return service.id;
}

export async function registerServiceRoutes(app: FastifyInstance, config: AppConfig): Promise<void> {
  const runtime = createServiceRuntimeManager(registryPathFor(config.vaultDir));

  app.get('/api/services/:assetId/health', async (request) => {
    const params = serviceAssetParamsSchema.parse(request.params);
    return runtime.health(await serviceIdForAsset(config.vaultDir, params.assetId));
  });

  app.post('/api/services/:assetId/start', async (request) => {
    const params = serviceAssetParamsSchema.parse(request.params);
    return runtime.start(await serviceIdForAsset(config.vaultDir, params.assetId));
  });

  app.post('/api/services/:assetId/stop', async (request) => {
    const params = serviceAssetParamsSchema.parse(request.params);
    return runtime.stop(await serviceIdForAsset(config.vaultDir, params.assetId));
  });
}
