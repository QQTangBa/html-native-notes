import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { watch, type FSWatcher } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { normalizeBridgeRequest, type NormalizedBridgeRequest } from '../shared/protocol';

interface WatcherOptions {
  rootDir: string;
  sourceAgent: string;
  settleMs?: number;
  pollMs?: number;
  onRequest: (request: NormalizedBridgeRequest) => void | Promise<void>;
}

interface ScanOptions {
  rootDir: string;
  sourceAgent: string;
}

export interface HtmlAssetWatcher {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

function isHtmlAsset(filePath: string): boolean {
  return /\.(html|htm|ainote\.html)$/i.test(filePath);
}

async function hashFile(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

function requestIdFor(filePath: string, sourceHash: string): string {
  return `watch:${Buffer.from(`${filePath}:${sourceHash}`).toString('base64url')}`;
}

async function buildWatchRequest(filePath: string, sourceAgent: string): Promise<NormalizedBridgeRequest> {
  const sourceHash = await hashFile(filePath);

  return normalizeBridgeRequest({
    requestId: requestIdFor(filePath, sourceHash),
    type: 'registerHtmlAsset',
    createdAt: new Date().toISOString(),
    sourceAgent,
    sourcePath: filePath,
    sourceHash,
    title: path.basename(filePath),
    tags: ['watcher'],
  });
}

async function listImmediateFiles(rootDir: string): Promise<string[]> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => path.join(rootDir, entry.name));
}

export async function scanExistingHtmlAssets(options: ScanOptions): Promise<NormalizedBridgeRequest[]> {
  const files = await listImmediateFiles(options.rootDir);
  const requests: NormalizedBridgeRequest[] = [];
  const seen = new Set<string>();

  for (const filePath of files) {
    if (!isHtmlAsset(filePath)) {
      continue;
    }

    const request = await buildWatchRequest(filePath, options.sourceAgent);

    if (seen.has(request.dedupeKey)) {
      continue;
    }

    seen.add(request.dedupeKey);
    requests.push(request);
  }

  return requests;
}

export function createHtmlAssetWatcher(options: WatcherOptions): HtmlAssetWatcher {
  const settleMs = options.settleMs ?? 100;
  const pollMs = options.pollMs ?? 250;
  const seen = new Set<string>();
  const timers = new Map<string, NodeJS.Timeout>();
  let watcher: FSWatcher | undefined;
  let poller: NodeJS.Timeout | undefined;

  async function emitIfHtml(filePath: string): Promise<void> {
    if (!isHtmlAsset(filePath) || !existsSync(filePath)) {
      return;
    }

    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return;
    }

    const request = await buildWatchRequest(filePath, options.sourceAgent);

    if (seen.has(request.dedupeKey)) {
      return;
    }

    seen.add(request.dedupeKey);
    await options.onRequest(request);
  }

  function schedule(filePath: string): void {
    const existingTimer = timers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      timers.delete(filePath);
      void emitIfHtml(filePath);
    }, settleMs);

    timers.set(filePath, timer);
  }

  async function scanForNewRequests(): Promise<void> {
    const requests = await scanExistingHtmlAssets(options);

    for (const request of requests) {
      if (seen.has(request.dedupeKey)) {
        continue;
      }

      seen.add(request.dedupeKey);
      await options.onRequest(request);
    }
  }

  return {
    async start() {
      const existing = await scanExistingHtmlAssets(options);
      for (const request of existing) {
        seen.add(request.dedupeKey);
      }

      watcher = watch(options.rootDir, (_eventType, filename) => {
        if (!filename) {
          return;
        }

        schedule(path.join(options.rootDir, filename.toString()));
      });
      poller = setInterval(() => {
        void scanForNewRequests();
      }, pollMs);
    },
    async stop() {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
      if (poller) {
        clearInterval(poller);
      }
      poller = undefined;
      watcher?.close();
      watcher = undefined;
    },
  };
}
