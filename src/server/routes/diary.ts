import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { runDiaryOrganization } from '../ai/diaryOrganizer';
import type { AppConfig } from '../../shared/types';

const diaryOrganizationSchema = z.object({
  originalText: z
    .string()
    .min(1)
    .max(30000)
    .refine((value) => value.trim().length > 0, 'Diary text is required'),
});

export async function registerDiaryRoutes(app: FastifyInstance, config: AppConfig): Promise<void> {
  app.post('/api/diary/organize', async (request, reply) => {
    const input = diaryOrganizationSchema.parse(request.body);

    try {
      return await runDiaryOrganization(config, input);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Diary organization failed';
      const isConfigError = message.includes('AI_');

      return reply.code(isConfigError ? 400 : 502).send({
        error: {
          code: isConfigError ? 'AI_CONFIG_ERROR' : 'AI_PROVIDER_ERROR',
          message,
        },
      });
    }
  });
}
