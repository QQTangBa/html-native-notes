#!/usr/bin/env tsx

import {
  htmlAssetRegistrationSchema,
  normalizeBridgeRequest,
  webServiceRegistrationSchema,
} from '../shared/protocol';
import { appendInboxRequest } from '../inbox/jsonlInbox';

type CliFlags = Record<string, string | string[]>;

function parseFlags(args: string[]): CliFlags {
  const flags: CliFlags = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (!token?.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const value = args[index + 1];

    if (!value || value.startsWith('--')) {
      flags[key] = 'true';
      continue;
    }

    if (key === 'tag') {
      const existing = flags[key];
      flags[key] = Array.isArray(existing) ? [...existing, value] : existing ? [String(existing), value] : [value];
    } else {
      flags[key] = value;
    }

    index += 1;
  }

  return flags;
}

function getFlag(flags: CliFlags, key: string): string | undefined {
  const value = flags[key];
  return Array.isArray(value) ? value.at(-1) : value;
}

function getTags(flags: CliFlags): string[] {
  const value = flags.tag;
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function acceptedResponse(type: 'registerHtmlAsset' | 'registerWebService', requestId: string, normalized: unknown) {
  const dedupeKey =
    typeof normalized === 'object' && normalized !== null && 'dedupeKey' in normalized
      ? String(normalized.dedupeKey)
      : requestId;

  return {
    ok: true,
    type,
    requestId,
    dedupeKey,
    acceptedAt: new Date().toISOString(),
    normalized,
  };
}

async function runRegister(flags: CliFlags): Promise<void> {
  const parsed = htmlAssetRegistrationSchema.parse({
    requestId: getFlag(flags, 'request-id'),
    filePath: getFlag(flags, 'file'),
    sourceHash: getFlag(flags, 'source-hash'),
    title: getFlag(flags, 'title'),
    tags: getTags(flags),
    sourceAgent: getFlag(flags, 'source-agent'),
    summary: getFlag(flags, 'summary'),
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

  const inboxPath = getFlag(flags, 'offline-inbox');

  if (inboxPath) {
    await appendInboxRequest(inboxPath, normalized);
  }

  printJson({
    ...acceptedResponse('registerHtmlAsset', parsed.requestId, normalized),
    ...(inboxPath ? { inboxPath } : {}),
  });
}

async function runServiceRegister(flags: CliFlags): Promise<void> {
  const port = getFlag(flags, 'port');
  const parsed = webServiceRegistrationSchema.parse({
    requestId: getFlag(flags, 'request-id'),
    title: getFlag(flags, 'title'),
    cwd: getFlag(flags, 'cwd'),
    startCommand: getFlag(flags, 'start'),
    stopCommand: getFlag(flags, 'stop'),
    url: getFlag(flags, 'url'),
    port: port ? Number.parseInt(port, 10) : undefined,
    healthCheckUrl: getFlag(flags, 'health-check-url'),
    envHints: [],
    logPath: getFlag(flags, 'log-path'),
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

  const inboxPath = getFlag(flags, 'offline-inbox');

  if (inboxPath) {
    await appendInboxRequest(inboxPath, normalized);
  }

  printJson({
    ...acceptedResponse('registerWebService', parsed.requestId, normalized),
    ...(inboxPath ? { inboxPath } : {}),
  });
}

async function main(args: string[]): Promise<void> {
  const [command, subcommand, ...rest] = args;

  if (command === 'register') {
    await runRegister(parseFlags([subcommand, ...rest].filter(Boolean)));
    return;
  }

  if (command === 'service' && subcommand === 'register') {
    await runServiceRegister(parseFlags(rest));
    return;
  }

  throw new Error('Unsupported htmlvault CLI command');
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unexpected CLI error';
  process.stderr.write(`${JSON.stringify({ error: { code: 'CLI_ERROR', message } }, null, 2)}\n`);
  process.exitCode = 1;
}
