import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import middie from '@fastify/middie';
import fastifyStatic from '@fastify/static';
import { createServer as createViteServer } from 'vite';
import { ZodError } from 'zod';
import type { AppConfig } from '../shared/types';
import { loadRuntimeConfig } from './config';
import { FileNoteStore } from './storage/noteStore';
import { registerAiRoutes } from './routes/ai';
import { registerAssetRoutes } from './routes/assets';
import { registerConfigRoutes } from './routes/config';
import { registerDiaryRoutes } from './routes/diary';
import { registerExportRoutes } from './routes/export';
import { registerHealthRoutes } from './routes/health';
import { registerInboxRoutes } from './routes/inbox';
import { registerNoteRoutes } from './routes/notes';
import { registerServiceRoutes } from './routes/services';
import { registerVaultRoutes } from './routes/vault';

interface CreateServerOptions {
  config?: AppConfig;
  enableVite?: boolean;
}

function isEntrypoint(): boolean {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

export async function createServer(options: CreateServerOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadRuntimeConfig();
  const app = fastify({
    logger: config.env !== 'test',
  });

  const store = new FileNoteStore(config.dataDir);
  await store.init();

  await app.register(cors, {
    origin: true,
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.flatten(),
        },
      });
    }

    const statusCode =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number' &&
      error.statusCode >= 400
        ? error.statusCode
        : 500;
    const message = error instanceof Error ? error.message : 'Unexpected server error';

    return reply.code(statusCode).send({
      error: {
        code: statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
        message,
      },
    });
  });

  await registerHealthRoutes(app);
  await registerConfigRoutes(app, config);
  await registerNoteRoutes(app, store);
  await registerInboxRoutes(app, config);
  await registerVaultRoutes(app, config);
  await registerServiceRoutes(app, config);
  await registerAssetRoutes(app, config);
  await registerDiaryRoutes(app, config);
  await registerExportRoutes(app, config);
  await registerAiRoutes(app, config);

  if (options.enableVite ?? config.env === 'development') {
    await app.register(middie);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use((request, response, next) => {
      if (request.url?.startsWith('/api/')) {
        next();
        return;
      }

      vite.middlewares(request, response, next);
    });
  } else {
    await app.register(fastifyStatic, {
      root: path.resolve(process.cwd(), 'dist'),
      wildcard: false,
    });
    app.setNotFoundHandler((_request, reply) => reply.sendFile('index.html'));
  }

  return app;
}

if (isEntrypoint()) {
  const config = loadRuntimeConfig();
  const app = await createServer({ config });
  await app.listen({ host: config.host, port: config.port });
}
