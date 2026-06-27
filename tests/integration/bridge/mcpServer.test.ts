// @vitest-environment node

import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { callMcpBridgeTool, listMcpBridgeTools } from '../../../bridge/mcp/server';
import { readVaultManifest } from '../../../bridge/vault/intake';
import { listVersionSnapshots } from '../../../bridge/vault/versionStore';

let tempDir: string;
let vaultDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), 'html-native-mcp-'));
  vaultDir = path.join(tempDir, 'Vault');
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function sha256(filePath: string): Promise<string> {
  return `sha256:${createHash('sha256').update(await readFile(filePath)).digest('hex')}`;
}

describe('MCP bridge server foundation', () => {
  it('exposes the PRD V1 bridge tools with JSON schemas', () => {
    const tools = listMcpBridgeTools();

    expect(tools.map((tool) => tool.name)).toEqual([
      'registerHtmlAsset',
      'registerWebService',
      'searchVault',
      'createNote',
      'snapshot',
      'publish',
      'importExisting',
    ]);
    expect(tools.every((tool) => tool.inputSchema.type === 'object')).toBe(true);
  });

  it('registers an HTML asset and searches it through MCP tool calls', async () => {
    const sourcePath = path.join(vaultDir, 'imports', 'agent', 'mcp-report.html');
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, '<!doctype html><title>MCP Report</title><main>Bridge market map</main>', 'utf8');

    const register = await callMcpBridgeTool({
      vaultDir,
      name: 'registerHtmlAsset',
      arguments: {
        requestId: 'mcp_html_1',
        filePath: sourcePath,
        sourceHash: await sha256(sourcePath),
        title: 'MCP Report',
        tags: ['mcp', 'market'],
        sourceAgent: 'codex',
      },
    });
    const search = await callMcpBridgeTool({
      vaultDir,
      name: 'searchVault',
      arguments: {
        query: 'market',
        tags: ['mcp'],
      },
    });

    expect(register).toMatchObject({ ok: true, type: 'registerHtmlAsset', created: true });
    expect(search).toMatchObject({
      ok: true,
      items: [expect.objectContaining({ title: 'MCP Report', tags: expect.arrayContaining(['mcp']) })],
    });
  });

  it('creates an HTML note, snapshots it, and publishes a local package through MCP tools', async () => {
    const created = await callMcpBridgeTool({
      vaultDir,
      name: 'createNote',
      arguments: {
        requestId: 'mcp_note_1',
        title: 'MCP Created Note',
        html: '<!doctype html><title>MCP Created Note</title><main><h1>MCP Created Note</h1></main>',
        tags: ['mcp-note'],
        sourceAgent: 'codex',
      },
    });
    const assetId = String((created as { vaultAssetId: string }).vaultAssetId);
    const snapshot = await callMcpBridgeTool({
      vaultDir,
      name: 'snapshot',
      arguments: {
        assetId,
        reason: 'mcp-manual-snapshot',
      },
    });
    const published = await callMcpBridgeTool({
      vaultDir,
      name: 'publish',
      arguments: {
        assetId,
        target: 'local-static-package',
      },
    });
    const snapshots = await listVersionSnapshots(vaultDir, assetId);

    expect(created).toMatchObject({ ok: true, type: 'createNote', created: true, vaultAssetId: expect.stringMatching(/^asset_/) });
    expect(snapshot).toMatchObject({ ok: true, snapshot: expect.objectContaining({ reason: 'mcp-manual-snapshot' }) });
    expect(published).toMatchObject({ ok: true, exportType: 'static-package', outputDir: expect.stringContaining(assetId) });
    expect(snapshots.map((item) => item.reason)).toEqual(['baseline', 'mcp-manual-snapshot']);
  });

  it('accepts service and importExisting requests without mutating external sources', async () => {
    const externalDir = path.join(tempDir, 'external-project');
    await mkdir(externalDir, { recursive: true });
    await writeFile(path.join(externalDir, 'index.html'), '<!doctype html><title>External</title>', 'utf8');

    const service = await callMcpBridgeTool({
      vaultDir,
      name: 'registerWebService',
      arguments: {
        requestId: 'mcp_service_1',
        title: 'MCP Dashboard',
        cwd: externalDir,
        startCommand: 'npm run dev',
        url: 'http://127.0.0.1:5173',
        port: 5173,
      },
    });
    const imported = await callMcpBridgeTool({
      vaultDir,
      name: 'importExisting',
      arguments: {
        requestId: 'mcp_import_1',
        sourcePath: externalDir,
        mode: 'read-only-scan',
      },
    });
    const manifest = await readVaultManifest(vaultDir);

    expect(service).toMatchObject({ ok: true, type: 'registerWebService', created: true });
    expect(imported).toMatchObject({ ok: true, type: 'importExisting', normalized: expect.objectContaining({ sourcePath: externalDir }) });
    expect(manifest.assets).toHaveLength(1);
    await expect(readFile(path.join(externalDir, 'index.html'), 'utf8')).resolves.toContain('External');
  });
});
