import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { runAiAction } from '../ai/openAiCompatibleClient';
import type { AppConfig } from '../../shared/types';

const aiActionSchema = z.object({
  action: z.enum(['summarize', 'rewrite', 'outline', 'translate', 'generate-section', 'clean-html']),
  content: z.string().min(1),
  selection: z.string().optional(),
  language: z.string().optional(),
});

export async function registerAiRoutes(app: FastifyInstance, config: AppConfig): Promise<void> {
  app.post('/api/ai/actions', async (request, reply) => {
    const input = aiActionSchema.parse(request.body);

    try {
      return await runAiAction(config, input);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI action failed';
      const isConfigError = message.includes('AI_');

      return reply.code(isConfigError ? 400 : 502).send({
        error: {
          code: isConfigError ? 'AI_CONFIG_ERROR' : 'AI_PROVIDER_ERROR',
          message,
        },
      });
    }
  });

  app.post('/api/ai/test', async (_request, reply) => {
    try {
      const response = await runAiAction(config, {
        action: 'summarize',
        content: '<p>Reply with a short readiness confirmation.</p>',
      });
      return response;
    } catch (error) {
      return reply.code(400).send({
        error: {
          code: 'AI_TEST_FAILED',
          message: error instanceof Error ? error.message : 'AI test failed',
        },
      });
    }
  });
}
