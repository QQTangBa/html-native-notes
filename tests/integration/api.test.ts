// @vitest-environment node

import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { intakeBridgeRequestToVault } from '../../bridge/vault/intake';
import { loadConfig } from '../../src/server/config';
import { createServer } from '../../src/server/index';

let tempDir: string;
let app: Awaited<ReturnType<typeof createServer>>;

function sha256(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), 'html-native-api-'));
  app = await createServer({
    config: loadConfig({
      APP_ENV: 'test',
      DATA_DIR: tempDir,
      AI_BASE_URL: 'https://api.deepseek.com',
      AI_MODEL: 'deepseek-v4-flash',
      AI_API_KEY: 'sk-test-hidden',
    }),
  });
  await app.ready();
});

afterEach(async () => {
  await app.close();
  await rm(tempDir, { recursive: true, force: true });
});

describe('local API', () => {
  it('reports health', async () => {
    const response = await request(app.server).get('/api/health').expect(200);

    expect(response.body).toEqual({ ok: true, name: 'html-native-notes' });
  });

  it('creates, lists, reads, saves, duplicates, and deletes notes', async () => {
    const created = await request(app.server)
      .post('/api/notes')
      .send({ title: 'API note', content: '<h1>Draft</h1>', tags: ['api'] })
      .expect(201);

    expect(created.body.title).toBe('API note');

    const listed = await request(app.server).get('/api/notes').expect(200);
    expect(listed.body).toHaveLength(1);

    const read = await request(app.server).get(`/api/notes/${created.body.id}`).expect(200);
    expect(read.body.content).toContain('Draft');

    const saved = await request(app.server)
      .put(`/api/notes/${created.body.id}/content`)
      .send({ content: '<h1>Saved</h1>' })
      .expect(200);
    expect(Date.parse(saved.body.updatedAt)).toBeGreaterThanOrEqual(Date.parse(created.body.updatedAt));

    const duplicated = await request(app.server).post(`/api/notes/${created.body.id}/duplicate`).expect(201);
    expect(duplicated.body.id).not.toBe(created.body.id);

    await request(app.server).delete(`/api/notes/${created.body.id}`).expect(204);
    await request(app.server).get(`/api/notes/${created.body.id}`).expect(404);
  });

  it('hides AI secret in config status', async () => {
    const response = await request(app.server).get('/api/config/ai/status').expect(200);

    expect(response.body).toEqual({
      configured: true,
      baseUrlSet: true,
      model: 'deepseek-v4-flash',
    });
    expect(JSON.stringify(response.body)).not.toContain('sk-test-hidden');
  });

  it('returns a clear AI configuration error when the key is missing', async () => {
    await app.close();
    app = await createServer({
      config: loadConfig({
        APP_ENV: 'test',
        DATA_DIR: tempDir,
        AI_BASE_URL: 'https://api.deepseek.com',
        AI_MODEL: 'deepseek-v4-flash',
      }),
    });
    await app.ready();

    const response = await request(app.server)
      .post('/api/ai/actions')
      .send({ action: 'summarize', content: '<p>Hello</p>' })
      .expect(400);

    expect(response.body.error.code).toBe('AI_CONFIG_ERROR');
    expect(response.body.error.message).toContain('AI_API_KEY');
  });

  it('returns the configured Vault Library for desktop home loading', async () => {
    const vaultDir = path.join(tempDir, 'vault');
    const aiDir = path.join(vaultDir, 'imports', 'ai');
    const htmlPath = path.join(aiDir, 'market.html');
    const html =
      '<html><head><title>Market Map</title><meta name="keywords" content="market, ai"><meta name="description" content="Agent generated market map"></head><body></body></html>';
    await mkdir(aiDir, { recursive: true });
    await writeFile(htmlPath, html, 'utf8');
    await intakeBridgeRequestToVault({
      vaultDir,
      request: {
        requestId: 'req_market_map',
        type: 'registerHtmlAsset',
        createdAt: '2026-06-27T00:00:00.000Z',
        sourceAgent: 'codex',
        sourcePath: htmlPath,
        sourceHash: sha256(html),
        title: 'Market Map',
        tags: ['agent'],
      },
    });

    const response = await request(app.server).get('/api/vault/library?q=market&tag=ai&sourceAgent=codex').expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      title: 'Market Map',
      sourceAgent: 'codex',
      relativeSourcePath: 'imports/ai/market.html',
      folderPath: 'imports/ai',
      summary: 'Agent generated market map',
    });
    expect(response.body.availableFilters.tags).toEqual(['agent', 'ai', 'market']);
  });

  it('generates missing Vault thumbnails through the local API', async () => {
    const vaultDir = path.join(tempDir, 'vault');
    const aiDir = path.join(vaultDir, 'imports', 'ai');
    const htmlPath = path.join(aiDir, 'api-thumbnail.html');
    const html =
      '<html><head><title>API Thumbnail</title></head><body><main style="padding:48px;font-family:sans-serif"><h1>API Thumbnail</h1></main></body></html>';
    await mkdir(aiDir, { recursive: true });
    await writeFile(htmlPath, html, 'utf8');
    const intake = await intakeBridgeRequestToVault({
      vaultDir,
      request: {
        requestId: 'req_api_thumbnail',
        type: 'registerHtmlAsset',
        createdAt: '2026-06-27T00:00:00.000Z',
        sourceAgent: 'codex',
        sourcePath: htmlPath,
        sourceHash: sha256(html),
        title: 'API Thumbnail',
      },
    });

    const response = await request(app.server).post('/api/vault/thumbnails/generate').expect(200);
    const expectedPath = path.join(vaultDir, '.htmlvault', 'thumbnails', `${intake.asset.id}.png`);

    expect(response.body).toMatchObject({
      ok: true,
      generatedCount: 1,
      skippedCount: 0,
      generated: [{ assetId: intake.asset.id, path: expectedPath }],
    });
    expect((await stat(expectedPath)).size).toBeGreaterThan(1000);

    const library = await request(app.server).get('/api/vault/library?q=api').expect(200);
    expect(library.body.items[0].thumbnail).toMatchObject({ status: 'ready', path: expectedPath });
  });

  it('returns registered Vault HTML source for read-only preview', async () => {
    const vaultDir = path.join(tempDir, 'vault');
    const aiDir = path.join(vaultDir, 'imports', 'ai');
    const htmlPath = path.join(aiDir, 'api-preview.html');
    const html = '<html><head><title>API Preview</title></head><body><h1>Preview Me</h1></body></html>';
    await mkdir(aiDir, { recursive: true });
    await writeFile(htmlPath, html, 'utf8');
    const intake = await intakeBridgeRequestToVault({
      vaultDir,
      request: {
        requestId: 'req_api_preview',
        type: 'registerHtmlAsset',
        createdAt: '2026-06-27T00:00:00.000Z',
        sourceAgent: 'codex',
        sourcePath: htmlPath,
        sourceHash: sha256(html),
        title: 'API Preview',
      },
    });

    const response = await request(app.server).get(`/api/vault/assets/${intake.asset.id}/source`).expect(200);

    expect(response.body).toMatchObject({
      assetId: intake.asset.id,
      title: 'API Preview',
      sourcePath: htmlPath,
      sourceHash: sha256(html),
      currentHash: sha256(html),
      sourceHashMatches: true,
      html,
    });
  });
});
