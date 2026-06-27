import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  htmlAssetRegistrationSchema,
  normalizeBridgeRequest,
  webServiceRegistrationSchema,
  type AgentInboxRequestInput,
} from '../shared/protocol';
import { exportVaultAssetStaticPackage } from '../exporter/staticPackage';
import { intakeBridgeRequestToVault, readVaultManifest } from '../vault/intake';
import { buildVaultLibrary } from '../vault/library';
import { createVersionSnapshot } from '../vault/versionStore';

type McpToolName =
  | 'registerHtmlAsset'
  | 'registerWebService'
  | 'searchVault'
  | 'createNote'
  | 'snapshot'
  | 'publish'
  | 'importExisting';

interface JsonObjectSchema {
  type: 'object';
  required?: string[];
  properties: Record<string, unknown>;
}

export interface McpBridgeTool {
  name: McpToolName;
  description: string;
  inputSchema: JsonObjectSchema;
}

export interface McpBridgeToolCall {
  vaultDir: string;
  name: McpToolName;
  arguments: Record<string, unknown>;
}

function objectSchema(required: string[], properties: Record<string, unknown>): JsonObjectSchema {
  return {
    type: 'object',
    required,
    properties,
  };
}

const tools: McpBridgeTool[] = [
  {
    name: 'registerHtmlAsset',
    description: 'Register an AI-generated local HTML file into the HTML Native Notes Vault.',
    inputSchema: objectSchema(['requestId', 'filePath', 'sourceHash'], {
      requestId: { type: 'string' },
      filePath: { type: 'string' },
      sourceHash: { type: 'string' },
      title: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      sourceAgent: { type: 'string' },
      summary: { type: 'string' },
    }),
  },
  {
    name: 'registerWebService',
    description: 'Register a local web service/dashboard so the app can health-check and start it.',
    inputSchema: objectSchema(['requestId', 'title', 'cwd', 'startCommand', 'url'], {
      requestId: { type: 'string' },
      title: { type: 'string' },
      cwd: { type: 'string' },
      startCommand: { type: 'string' },
      stopCommand: { type: 'string' },
      url: { type: 'string' },
      port: { type: 'number' },
      healthCheckUrl: { type: 'string' },
      logPath: { type: 'string' },
    }),
  },
  {
    name: 'searchVault',
    description: 'Search the local Vault library by query, tag, source agent, kind, or folder.',
    inputSchema: objectSchema([], {
      query: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      sourceAgents: { type: 'array', items: { type: 'string' } },
      kinds: { type: 'array', items: { type: 'string' } },
      folders: { type: 'array', items: { type: 'string' } },
    }),
  },
  {
    name: 'createNote',
    description: 'Create a new HTML note file in the Vault and register it as a bridge asset.',
    inputSchema: objectSchema(['requestId', 'title', 'html'], {
      requestId: { type: 'string' },
      title: { type: 'string' },
      html: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      sourceAgent: { type: 'string' },
    }),
  },
  {
    name: 'snapshot',
    description: 'Create a version snapshot for a registered Vault HTML asset.',
    inputSchema: objectSchema(['assetId', 'reason'], {
      assetId: { type: 'string' },
      reason: { type: 'string' },
    }),
  },
  {
    name: 'publish',
    description: 'Export a registered Vault HTML asset to a local static package.',
    inputSchema: objectSchema(['assetId', 'target'], {
      assetId: { type: 'string' },
      target: { type: 'string', enum: ['local-static-package'] },
    }),
  },
  {
    name: 'importExisting',
    description: 'Accept an existing project import request as a read-only scan request.',
    inputSchema: objectSchema(['requestId', 'sourcePath'], {
      requestId: { type: 'string' },
      sourcePath: { type: 'string' },
      mode: { type: 'string' },
      sourceAgent: { type: 'string' },
    }),
  },
];

export function listMcpBridgeTools(): McpBridgeTool[] {
  return tools;
}

function response(type: string, requestId: string, normalized: unknown, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const dedupeKey =
    typeof normalized === 'object' && normalized !== null && 'dedupeKey' in normalized
      ? String((normalized as { dedupeKey: unknown }).dedupeKey)
      : requestId;

  return {
    ok: true,
    type,
    requestId,
    dedupeKey,
    acceptedAt: new Date().toISOString(),
    normalized,
    ...extra,
  };
}

function stringArg(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === 'string' ? value : undefined;
}

function stringArrayArg(args: Record<string, unknown>, key: string): string[] {
  const value = args[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

async function sha256(filePath: string): Promise<string> {
  return `sha256:${createHash('sha256').update(await readFile(filePath)).digest('hex')}`;
}

function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, '-')
      .replace(/^-+|-+$/g, '') || 'untitled'
  );
}

async function registerHtmlAsset(vaultDir: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const parsed = htmlAssetRegistrationSchema.parse({
    requestId: args.requestId,
    filePath: args.filePath,
    sourceHash: args.sourceHash,
    title: args.title,
    tags: args.tags,
    sourceAgent: args.sourceAgent,
    summary: args.summary,
  });
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
  const intake = await intakeBridgeRequestToVault({ vaultDir, request: normalized });

  return response('registerHtmlAsset', parsed.requestId, normalized, {
    created: intake.created,
    manifestPath: intake.manifestPath,
    vaultAssetId: intake.asset.id,
  });
}

async function registerWebService(vaultDir: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const parsed = webServiceRegistrationSchema.parse({
    requestId: args.requestId,
    title: args.title,
    cwd: args.cwd,
    startCommand: args.startCommand,
    stopCommand: args.stopCommand,
    url: args.url,
    port: args.port,
    healthCheckUrl: args.healthCheckUrl,
    envHints: [],
    logPath: args.logPath,
  });
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
  const intake = await intakeBridgeRequestToVault({ vaultDir, request: normalized });

  return response('registerWebService', parsed.requestId, normalized, {
    created: intake.created,
    manifestPath: intake.manifestPath,
    vaultAssetId: intake.asset.id,
  });
}

async function createNote(vaultDir: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const requestId = stringArg(args, 'requestId');
  const title = stringArg(args, 'title');
  const html = stringArg(args, 'html');
  if (!requestId || !title || !html) {
    throw new Error('createNote requires requestId, title, and html');
  }

  const filePath = path.join(vaultDir, 'imports', 'mcp-notes', `${slugify(title)}.html`);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, html, 'utf8');

  const registered = await registerHtmlAsset(vaultDir, {
    requestId,
    filePath,
    sourceHash: await sha256(filePath),
    title,
    tags: stringArrayArg(args, 'tags'),
    sourceAgent: stringArg(args, 'sourceAgent') ?? 'mcp',
  });

  return {
    ...registered,
    type: 'createNote',
    outputPath: filePath,
  };
}

async function snapshot(vaultDir: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const assetId = stringArg(args, 'assetId');
  const reason = stringArg(args, 'reason');
  if (!assetId || !reason) {
    throw new Error('snapshot requires assetId and reason');
  }

  const asset = (await readVaultManifest(vaultDir)).assets.find((item) => item.id === assetId);
  if (!asset?.sourcePath) {
    throw new Error(`Vault asset source not found: ${assetId}`);
  }

  return {
    ok: true,
    snapshot: await createVersionSnapshot({
      vaultDir,
      assetId,
      sourcePath: asset.sourcePath,
      reason,
    }),
  };
}

async function publish(vaultDir: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const assetId = stringArg(args, 'assetId');
  const target = stringArg(args, 'target');
  if (!assetId || target !== 'local-static-package') {
    throw new Error('publish currently supports target=local-static-package');
  }

  return {
    ok: true,
    ...(await exportVaultAssetStaticPackage({ vaultDir, assetId })),
  };
}

function importExisting(args: Record<string, unknown>): Record<string, unknown> {
  const requestId = stringArg(args, 'requestId');
  const sourcePath = stringArg(args, 'sourcePath');
  if (!requestId || !sourcePath) {
    throw new Error('importExisting requires requestId and sourcePath');
  }

  const request: AgentInboxRequestInput = {
    requestId,
    type: 'importExisting',
    createdAt: new Date().toISOString(),
    sourceAgent: stringArg(args, 'sourceAgent') ?? 'mcp',
    sourcePath,
    metadata: {
      mode: stringArg(args, 'mode') ?? 'read-only-scan',
    },
  };
  const normalized = normalizeBridgeRequest(request);

  return response('importExisting', requestId, normalized);
}

export async function callMcpBridgeTool(call: McpBridgeToolCall): Promise<Record<string, unknown>> {
  if (call.name === 'registerHtmlAsset') {
    return registerHtmlAsset(call.vaultDir, call.arguments);
  }

  if (call.name === 'registerWebService') {
    return registerWebService(call.vaultDir, call.arguments);
  }

  if (call.name === 'searchVault') {
    const library = await buildVaultLibrary({
      vaultDir: call.vaultDir,
      query: stringArg(call.arguments, 'query'),
      tags: stringArrayArg(call.arguments, 'tags'),
      sourceAgents: stringArrayArg(call.arguments, 'sourceAgents'),
      folders: stringArrayArg(call.arguments, 'folders'),
    });
    return { ok: true, ...library };
  }

  if (call.name === 'createNote') {
    return createNote(call.vaultDir, call.arguments);
  }

  if (call.name === 'snapshot') {
    return snapshot(call.vaultDir, call.arguments);
  }

  if (call.name === 'publish') {
    return publish(call.vaultDir, call.arguments);
  }

  if (call.name === 'importExisting') {
    return importExisting(call.arguments);
  }

  throw new Error(`Unsupported MCP bridge tool: ${String(call.name)}`);
}
