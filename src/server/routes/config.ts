import type { FastifyInstance } from 'fastify';
import { getSafeAiStatus } from '../config';
import type { AppConfig } from '../../shared/types';

export async function registerConfigRoutes(app: FastifyInstance, config: AppConfig): Promise<void> {
  app.get('/api/config/ai/status', async () => getSafeAiStatus(config));
}
