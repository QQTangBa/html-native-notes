import type { FastifyInstance } from 'fastify';
import {
  htmlAssetRegistrationSchema,
  normalizeBridgeRequest,
  webServiceRegistrationSchema,
} from '../shared/protocol';
import { intakeBridgeRequestToVault } from '../vault/intake';

export interface AgentBridgeHttpRouteOptions {
  vaultDir?: string;
}

interface AcceptedBridgeRequest {
  ok: true;
  type: 'registerHtmlAsset' | 'registerWebService';
  requestId: string;
  dedupeKey: string;
  acceptedAt: string;
  normalized: unknown;
  created?: boolean;
  manifestPath?: string;
  vaultAssetId?: string;
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

export async function registerAgentBridgeHttpRoutes(
  app: FastifyInstance,
  options: AgentBridgeHttpRouteOptions = {},
): Promise<void> {
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

    const response = acceptedResponse('registerHtmlAsset', parsed.requestId, normalized, normalized.dedupeKey);

    if (options.vaultDir) {
      const intake = await intakeBridgeRequestToVault({
        vaultDir: options.vaultDir,
        request: normalized,
      });

      response.created = intake.created;
      response.manifestPath = intake.manifestPath;
      response.vaultAssetId = intake.asset.id;
    }

    return reply.code(202).send(response);
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

    const response = acceptedResponse('registerWebService', parsed.requestId, normalized, normalized.dedupeKey);

    if (options.vaultDir) {
      const intake = await intakeBridgeRequestToVault({
        vaultDir: options.vaultDir,
        request: normalized,
      });

      response.created = intake.created;
      response.manifestPath = intake.manifestPath;
      response.vaultAssetId = intake.asset.id;
    }

    return reply.code(202).send(response);
  });
}
