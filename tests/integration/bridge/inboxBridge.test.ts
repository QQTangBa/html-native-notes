// @vitest-environment node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  appendInboxRequest,
  acknowledgeInboxRequests,
  readInboxRequests,
} from '../../../bridge/inbox/jsonlInbox';

let tempDir: string;
let inboxPath: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), 'html-native-inbox-'));
  inboxPath = path.join(tempDir, 'requests.jsonl');
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('agent bridge offline inbox', () => {
  it('appends normalized JSONL requests for software-not-running fallback', async () => {
    const appended = await appendInboxRequest(inboxPath, {
      requestId: 'inbox-html-001',
      type: 'registerHtmlAsset',
      createdAt: '2026-06-26T12:00:00.000Z',
      sourcePath: '/Users/example/work/report.html',
      sourceHash: 'sha256:inbox123',
      title: 'Inbox Report',
      tags: ['AI', ' inbox '],
      sourceAgent: 'codex',
    });

    expect(appended).toMatchObject({
      requestId: 'inbox-html-001',
      dedupeKey: 'registerHtmlAsset:sha256:inbox123',
      tags: ['ai', 'inbox'],
    });

    const raw = await readFile(inboxPath, 'utf8');
    expect(raw.trim().split('\n')).toHaveLength(1);
    expect(JSON.parse(raw)).toMatchObject({
      requestId: 'inbox-html-001',
      dedupeKey: 'registerHtmlAsset:sha256:inbox123',
    });
  });

  it('reads valid inbox requests, skips duplicate dedupe keys, and reports bad lines', async () => {
    await mkdir(path.dirname(inboxPath), { recursive: true });
    await writeFile(
      inboxPath,
      [
        JSON.stringify({
          requestId: 'inbox-html-001',
          type: 'registerHtmlAsset',
          createdAt: '2026-06-26T12:00:00.000Z',
          sourcePath: '/Users/example/work/report.html',
          sourceHash: 'sha256:dupe',
          tags: ['a'],
        }),
        JSON.stringify({
          requestId: 'inbox-html-002',
          type: 'registerHtmlAsset',
          createdAt: '2026-06-26T12:00:01.000Z',
          sourcePath: '/Users/example/work/report-copy.html',
          sourceHash: 'sha256:dupe',
          tags: ['b'],
        }),
        '{bad json',
        JSON.stringify({
          requestId: 'inbox-service-001',
          type: 'registerWebService',
          createdAt: '2026-06-26T12:00:02.000Z',
          service: {
            title: 'Dashboard',
            cwd: '/Users/example/dashboard',
            startCommand: 'npm run dev',
            url: 'http://127.0.0.1:5173',
          },
        }),
      ].join('\n'),
    );

    const result = await readInboxRequests(inboxPath);

    expect(result.requests.map((request) => request.requestId)).toEqual([
      'inbox-html-001',
      'inbox-service-001',
    ]);
    expect(result.skippedDuplicates).toEqual(['inbox-html-002']);
    expect(result.invalidLines).toEqual([{ lineNumber: 3, reason: 'Invalid JSON' }]);
  });

  it('acknowledges processed requests by rewriting pending lines only', async () => {
    await appendInboxRequest(inboxPath, {
      requestId: 'inbox-html-001',
      type: 'registerHtmlAsset',
      createdAt: '2026-06-26T12:00:00.000Z',
      sourcePath: '/Users/example/work/report.html',
      sourceHash: 'sha256:ack1',
    });
    await appendInboxRequest(inboxPath, {
      requestId: 'inbox-html-002',
      type: 'registerHtmlAsset',
      createdAt: '2026-06-26T12:00:01.000Z',
      sourcePath: '/Users/example/work/report-2.html',
      sourceHash: 'sha256:ack2',
    });

    const remaining = await acknowledgeInboxRequests(inboxPath, ['inbox-html-001']);

    expect(remaining.map((request) => request.requestId)).toEqual(['inbox-html-002']);

    const reread = await readInboxRequests(inboxPath);
    expect(reread.requests.map((request) => request.requestId)).toEqual(['inbox-html-002']);
  });
});
