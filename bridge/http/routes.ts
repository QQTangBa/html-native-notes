import type { FastifyInstance } from 'fastify';
import {
  htmlAssetRegistrationSchema,
  normalizeBridgeRequest,
  webServiceRegistrationSchema,
} from '../shared/protocol';

interface AcceptedBridgeRequest {
  ok: true;
  type: 'registerHtmlAsset' | 'registerWebService';
  requestId: string;
  dedupeKey: string;
  acceptedAt: string;
  normalized: unknown;
}

function acceptedResponse(
  type: AcceptedBridgeRequest['type'],
  requestId: string,
  normalized: unknown,
  dedupeKey: string,
): AcceptedBridgeRequest {
  return {
    ok: true,
    type,
    requestId,
    dedupeKey,
    acceptedAt: new Date().toISOString(),
    normalized,
  };
}

export async function registerAgentBridgeHttpRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({
    ok: true,
    name: 'html-native-notes-agent-bridge',
    transports: ['http'],
  }));

  app.post('/api/agent/register-html', async (request, reply) => {
    const parsed = htmlAssetRegistrationSchema.parse(request.body);
    const normalized = normalizeBridgeRequest({
      requestId: parsed.requestId,
      type: parsed.type,
      createdAt: parsed.createdAt ?? new Date().toISOString(),
      sourceAgent: parsed.sourceAgent,
      sourcePath: parsed.sourcePath,
      sourceHash: parsed.sourceHash,
      title: parsed.title,
      tags: parsed.tags,
      metadata: {
        summary: parsed.summary,
      },
    });

    return reply
      .code(202)
      .send(acceptedResponse('registerHtmlAsset', parsed.requestId, normalized, normalized.dedupeKey));
  });

  app.post('/api/agent/register-service', async (request, reply) => {
    const parsed = webServiceRegistrationSchema.parse(request.body);
    const normalized = normalizeBridgeRequest({
      requestId: parsed.requestId,
      type: parsed.type,
      createdAt: parsed.createdAt ?? new Date().toISOString(),
      service: parsed.service,
      title: parsed.service.title,
      metadata: {
        url: parsed.service.url,
        port: parsed.service.port,
      },
    });

    return reply
      .code(202)
      .send(acceptedResponse('registerWebService', parsed.requestId, normalized, normalized.dedupeKey));
  });
}
