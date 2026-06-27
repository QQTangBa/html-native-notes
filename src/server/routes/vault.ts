import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildVaultLibrary } from '../../../bridge/vault/library';
import { generateMissingVaultThumbnails } from '../../../bridge/vault/thumbnails';
import type { AppConfig } from '../../shared/types';

const libraryQuerySchema = z.object({
  q: z.string().optional(),
  tag: z.union([z.string(), z.array(z.string())]).optional(),
  sourceAgent: z.union([z.string(), z.array(z.string())]).optional(),
  kind: z.union([z.enum(['html-note', 'service', 'project']), z.array(z.enum(['html-note', 'service', 'project']))]).optional(),
  folder: z.union([z.string(), z.array(z.string())]).optional(),
});

function asArray<T extends string>(value: T | T[] | undefined): T[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  return Array.isArray(value) ? value : [value];
}

export async function registerVaultRoutes(app: FastifyInstance, config: AppConfig): Promise<void> {
  app.get('/api/vault/library', async (request) => {
    const query = libraryQuerySchema.parse(request.query);

    return buildVaultLibrary({
      vaultDir: config.vaultDir,
      query: query.q,
      tags: asArray(query.tag),
      sourceAgents: asArray(query.sourceAgent),
      kinds: asArray(query.kind),
      folders: asArray(query.folder),
    });
  });

  app.post('/api/vault/thumbnails/generate', async () => {
    const result = await generateMissingVaultThumbnails({ vaultDir: config.vaultDir });

    return {
      ok: true,
      generatedCount: result.generated.length,
      skippedCount: result.skipped.length,
      ...result,
    };
  });
}
