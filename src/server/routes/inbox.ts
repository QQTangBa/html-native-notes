import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import { z } from 'zod';
import { acknowledgeInboxRequests, readInboxRequests } from '../../../bridge/inbox/jsonlInbox';
import { intakeBridgeRequestToVault } from '../../../bridge/vault/intake';
import type { AppConfig } from '../../shared/types';

const inboxParamsSchema = z.object({
  requestId: z.string().min(1),
});

function inboxPathFor(vaultDir: string): string {
  return path.join(vaultDir, '.htmlvault', 'inbox', 'requests.jsonl');
}

function httpError(message: string, statusCode: number): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}

export async function registerInboxRoutes(app: FastifyInstance, config: AppConfig): Promise<void> {
  app.get('/api/agent/inbox', async () => readInboxRequests(inboxPathFor(config.vaultDir)));

  app.post('/api/agent/inbox/:requestId/confirm', async (request) => {
    const params = inboxParamsSchema.parse(request.params);
    const inboxPath = inboxPathFor(config.vaultDir);
    const inbox = await readInboxRequests(inboxPath);
    const pending = inbox.requests.find((item) => item.requestId === params.requestId);

    if (!pending) {
      throw httpError('Inbox request not found', 404);
    }

    const intake = await intakeBridgeRequestToVault({
      vaultDir: config.vaultDir,
      request: pending,
    });

    return {
      intake,
      inbox: await readInboxRequestsAfterAck(inboxPath, params.requestId),
    };
  });

  app.post('/api/agent/inbox/:requestId/dismiss', async (request) => {
    const params = inboxParamsSchema.parse(request.params);
    const inboxPath = inboxPathFor(config.vaultDir);

    return readInboxRequestsAfterAck(inboxPath, params.requestId);
  });
}

async function readInboxRequestsAfterAck(inboxPath: string, requestId: string) {
  await acknowledgeInboxRequests(inboxPath, [requestId]);
  return readInboxRequests(inboxPath);
}
