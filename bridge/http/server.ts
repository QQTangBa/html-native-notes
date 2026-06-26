import fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { registerAgentBridgeHttpRoutes } from './routes';

export async function createAgentBridgeHttpServer(): Promise<FastifyInstance> {
  const app = fastify({ logger: false });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Agent bridge request validation failed',
          details: error.flatten(),
        },
      });
    }

    const message = error instanceof Error ? error.message : 'Unexpected bridge error';
    return reply.code(500).send({
      error: {
        code: 'BRIDGE_INTERNAL_ERROR',
        message,
      },
    });
  });

  await registerAgentBridgeHttpRoutes(app);

  return app;
}
