import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { publishVaultAssetStatic } from '../../../bridge/publish/staticProvider';
import type { AppConfig } from '../../shared/types';

const publishParamsSchema = z.object({
  assetId: z.string().regex(/^asset_[A-Za-z0-9_-]+$/, 'Invalid asset id'),
});

function publishStatusCode(message: string): number {
  if (message.includes('not configured') || message.includes('required environment variable')) {
    return 400;
  }

  return 502;
}

export async function registerPublishRoutes(app: FastifyInstance, config: AppConfig): Promise<void> {
  app.post('/api/publish/:assetId/static', async (request, reply) => {
    const params = publishParamsSchema.parse(request.params);

    try {
      return await publishVaultAssetStatic({
        vaultDir: config.vaultDir,
        assetId: params.assetId,
        provider: config.publish,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Static publish failed';
      return reply.code(publishStatusCode(message)).send({
        error: {
          code: 'PUBLISH_ERROR',
          message,
        },
      });
    }
  });
}
