import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  normalizeBridgeRequest,
  type AgentInboxRequestInput,
  type NormalizedBridgeRequest,
} from '../shared/protocol';

export interface InvalidInboxLine {
  lineNumber: number;
  reason: string;
}

export interface InboxReadResult {
  requests: NormalizedBridgeRequest[];
  invalidLines: InvalidInboxLine[];
  skippedDuplicates: string[];
}

function serializeRequest(request: NormalizedBridgeRequest): string {
  return JSON.stringify(request);
}

export async function appendInboxRequest(
  inboxPath: string,
  request: AgentInboxRequestInput,
): Promise<NormalizedBridgeRequest> {
  const normalized = normalizeBridgeRequest(request);

  await mkdir(path.dirname(inboxPath), { recursive: true });
  await appendFile(inboxPath, `${serializeRequest(normalized)}\n`, 'utf8');

  return normalized;
}

async function readInboxFile(inboxPath: string): Promise<string> {
  try {
    return await readFile(inboxPath, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return '';
    }

    throw error;
  }
}

export async function readInboxRequests(inboxPath: string): Promise<InboxReadResult> {
  const raw = await readInboxFile(inboxPath);
  const seenDedupeKeys = new Set<string>();
  const requests: NormalizedBridgeRequest[] = [];
  const invalidLines: InvalidInboxLine[] = [];
  const skippedDuplicates: string[] = [];

  raw
    .split('\n')
    .map((line) => line.trim())
    .forEach((line, index) => {
      if (!line) {
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        invalidLines.push({ lineNumber: index + 1, reason: 'Invalid JSON' });
        return;
      }

      try {
        const normalized = normalizeBridgeRequest(parsed);

        if (seenDedupeKeys.has(normalized.dedupeKey)) {
          skippedDuplicates.push(normalized.requestId);
          return;
        }

        seenDedupeKeys.add(normalized.dedupeKey);
        requests.push(normalized);
      } catch (error) {
        invalidLines.push({
          lineNumber: index + 1,
          reason: error instanceof Error ? error.message : 'Invalid request',
        });
      }
    });

  return { requests, invalidLines, skippedDuplicates };
}

export async function acknowledgeInboxRequests(
  inboxPath: string,
  processedRequestIds: string[],
): Promise<NormalizedBridgeRequest[]> {
  const processed = new Set(processedRequestIds);
  const { requests } = await readInboxRequests(inboxPath);
  const remaining = requests.filter((request) => !processed.has(request.requestId));
  const tempPath = `${inboxPath}.tmp`;
  const nextContent = remaining.map(serializeRequest).join('\n');

  await mkdir(path.dirname(inboxPath), { recursive: true });
  await writeFile(tempPath, nextContent ? `${nextContent}\n` : '', 'utf8');
  await rename(tempPath, inboxPath);

  return remaining;
}
