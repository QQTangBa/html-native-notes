// @vitest-environment node

import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerWebService } from '../../bridge/service/runtime';
import { intakeBridgeRequestToVault } from '../../bridge/vault/intake';
import { loadConfig } from '../../src/server/config';
import { createServer } from '../../src/server/index';

let tempDir: string;
let app: Awaited<ReturnType<typeof createServer>>;

function sha256(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

function rawSha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

async function getAvailablePort(): Promise<number> {
  const server = createNetServer();

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === 'object') {
          resolve(address.port);
          return;
        }

        reject(new Error('Unable to reserve test port'));
      });
    });
  });
}

async function createFixtureService(port: number): Promise<{ cwd: string; logPath: string }> {
  const cwd = path.join(tempDir, `fixture-service-${port}`);
  const logPath = path.join(cwd, 'service.log');
  const serverPath = path.join(cwd, 'server.mjs');

  await mkdir(cwd, { recursive: true });
  await writeFile(
    serverPath,
    [
      "import http from 'node:http';",
      `const port = ${port};`,
      "const server = http.createServer((req, res) => {",
      "  if (req.url === '/health') {",
      "    res.writeHead(200, { 'content-type': 'application/json' });",
      "    res.end(JSON.stringify({ ok: true }));",
      '    return;',
      '  }',
      "  res.end('dashboard');",
      '});',
      "server.listen(port, '127.0.0.1', () => console.log(`ready:${port}`));",
      "process.on('SIGTERM', () => server.close(() => process.exit(0)));",
    ].join('\n'),
    'utf8',
  );

  return { cwd, logPath };
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

  it('organizes diary text into two styles without exposing AI secrets', async () => {
    const providerFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  styles: [
                    {
                      style: 'timeline',
                      title: '按时间线整理',
                      summary: '先记录情绪，再记录行动。',
                      html: '<section><h2>按时间线整理</h2><p>下午完成了项目推进。</p></section>',
                    },
                    {
                      style: 'themes',
                      title: '按主题整理',
                      summary: '情绪、行动、明日提醒。',
                      html: '<section><h2>按主题整理</h2><p>明天继续收尾。</p></section>',
                    },
                  ],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', providerFetch);

    try {
      const response = await request(app.server)
        .post('/api/diary/organize')
        .send({ originalText: '今天状态很乱，但下午把项目推进了一点。晚上需要早点休息。' })
        .expect(200);

      expect(response.body.originalText).toBe('今天状态很乱，但下午把项目推进了一点。晚上需要早点休息。');
      expect(response.body.styles).toHaveLength(2);
      expect(response.body.styles[0]).toMatchObject({
        style: 'timeline',
        title: '按时间线整理',
      });
      expect(JSON.stringify(response.body)).not.toContain('sk-test-hidden');
    } finally {
      vi.unstubAllGlobals();
    }
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

  it('reviews Vault HTML edits and applies explicit Source Guard decisions', async () => {
    const vaultDir = path.join(tempDir, 'vault');
    const aiDir = path.join(vaultDir, 'imports', 'ai');
    const htmlPath = path.join(aiDir, 'api-write-gate.html');
    const originalHtml = '<html><body><h1>Original</h1><p>Alpha</p></body></html>';
    const editedHtml = '<html><body><h1>Original</h1><p>Beta</p></body></html>';
    await mkdir(aiDir, { recursive: true });
    await writeFile(htmlPath, originalHtml, 'utf8');
    const intake = await intakeBridgeRequestToVault({
      vaultDir,
      request: {
        requestId: 'req_api_write_gate',
        type: 'registerHtmlAsset',
        createdAt: '2026-06-27T00:00:00.000Z',
        sourceAgent: 'codex',
        sourcePath: htmlPath,
        sourceHash: sha256(originalHtml),
        title: 'API Write Gate',
      },
    });

    const reviewResponse = await request(app.server)
      .post(`/api/vault/assets/${intake.asset.id}/write-review`)
      .send({ editedHtml })
      .expect(200);

    expect(reviewResponse.body).toMatchObject({
      sourcePath: htmlPath,
      originalHtml,
      editedHtml,
      status: 'changed',
    });
    expect(reviewResponse.body.diff).toContain('-<html><body><h1>Original</h1><p>Alpha</p></body></html>');
    expect(reviewResponse.body.diff).toContain('+<html><body><h1>Original</h1><p>Beta</p></body></html>');
    expect(await readFile(htmlPath, 'utf8')).toBe(originalHtml);

    const cancelResponse = await request(app.server)
      .post('/api/vault/write-decision')
      .send({ assetId: intake.asset.id, editedHtml, decision: { action: 'cancel' } })
      .expect(200);
    expect(cancelResponse.body).toEqual({ action: 'cancel' });
    expect(await readFile(htmlPath, 'utf8')).toBe(originalHtml);

    const saveAsPath = path.join(vaultDir, 'exports', 'api-write-gate-copy.html');
    const saveAsResponse = await request(app.server)
      .post('/api/vault/write-decision')
      .send({ assetId: intake.asset.id, editedHtml, decision: { action: 'save-as', saveAsPath } })
      .expect(200);
    expect(saveAsResponse.body).toEqual({ action: 'save-as', outputPath: saveAsPath });
    expect(await readFile(saveAsPath, 'utf8')).toBe(editedHtml);
    expect(await readFile(htmlPath, 'utf8')).toBe(originalHtml);

    const writeBackResponse = await request(app.server)
      .post('/api/vault/write-decision')
      .send({ assetId: intake.asset.id, editedHtml, decision: { action: 'write-back' } })
      .expect(200);
    expect(writeBackResponse.body).toEqual({ action: 'write-back', outputPath: htmlPath });
    expect(await readFile(htmlPath, 'utf8')).toBe(editedHtml);
  });

  it('recomputes write decisions server-side instead of trusting a client-supplied review', async () => {
    const vaultDir = path.join(tempDir, 'vault');
    const aiDir = path.join(vaultDir, 'imports', 'ai');
    const htmlPath = path.join(aiDir, 'api-write-gate.html');
    const otherPath = path.join(aiDir, 'other.html');
    const originalHtml = '<html><body><h1>Original</h1><p>Alpha</p></body></html>';
    const editedHtml = '<html><body><h1>Original</h1><p>Beta</p></body></html>';
    const otherHtml = '<html><body><h1>Other</h1></body></html>';
    await mkdir(aiDir, { recursive: true });
    await writeFile(htmlPath, originalHtml, 'utf8');
    await writeFile(otherPath, otherHtml, 'utf8');
    const intake = await intakeBridgeRequestToVault({
      vaultDir,
      request: {
        requestId: 'req_api_review_recompute',
        type: 'registerHtmlAsset',
        createdAt: '2026-06-27T00:00:00.000Z',
        sourceAgent: 'codex',
        sourcePath: htmlPath,
        sourceHash: sha256(originalHtml),
        title: 'API Review Recompute',
      },
    });

    await request(app.server)
      .post('/api/vault/write-decision')
      .send({
        assetId: intake.asset.id,
        editedHtml,
        decision: { action: 'write-back' },
        review: {
          sourcePath: otherPath,
          expectedSourceHash: rawSha256(otherHtml),
          originalHtml: otherHtml,
          editedHtml: '<html><body><h1>Forged</h1></body></html>',
          status: 'changed',
          diff: '-other\n+forged',
        },
      })
      .expect(200);

    expect(await readFile(htmlPath, 'utf8')).toBe(editedHtml);
    expect(await readFile(otherPath, 'utf8')).toBe(otherHtml);
  });

  it('rejects Source Guard source paths that resolve outside the configured Vault', async () => {
    const vaultDir = path.join(tempDir, 'vault');
    const importsDir = path.join(vaultDir, 'imports');
    const outsideDir = path.join(tempDir, 'outside');
    const linkedDir = path.join(importsDir, 'linked');
    const htmlPath = path.join(linkedDir, 'outside.html');
    const originalHtml = '<html><body><h1>Outside</h1></body></html>';
    await mkdir(importsDir, { recursive: true });
    await mkdir(outsideDir, { recursive: true });
    await symlink(outsideDir, linkedDir, 'dir');
    await writeFile(path.join(outsideDir, 'outside.html'), originalHtml, 'utf8');
    const intake = await intakeBridgeRequestToVault({
      vaultDir,
      request: {
        requestId: 'req_api_symlink_source',
        type: 'registerHtmlAsset',
        createdAt: '2026-06-27T00:00:00.000Z',
        sourceAgent: 'codex',
        sourcePath: htmlPath,
        sourceHash: sha256(originalHtml),
        title: 'API Symlink Source',
      },
    });

    await request(app.server)
      .post(`/api/vault/assets/${intake.asset.id}/write-review`)
      .send({ editedHtml: '<html><body><h1>Edited Outside</h1></body></html>' })
      .expect(400);

    expect(await readFile(path.join(outsideDir, 'outside.html'), 'utf8')).toBe(originalHtml);
  });

  it('rejects save-as collisions and symlink targets outside the configured Vault', async () => {
    const vaultDir = path.join(tempDir, 'vault');
    const aiDir = path.join(vaultDir, 'imports', 'ai');
    const outsideDir = path.join(tempDir, 'outside-save-as');
    const linkedDir = path.join(vaultDir, 'exports-link');
    const htmlPath = path.join(aiDir, 'api-save-as.html');
    const originalHtml = '<html><body><h1>Original</h1><p>Alpha</p></body></html>';
    const editedHtml = '<html><body><h1>Original</h1><p>Beta</p></body></html>';
    await mkdir(aiDir, { recursive: true });
    await mkdir(outsideDir, { recursive: true });
    await symlink(outsideDir, linkedDir, 'dir');
    await writeFile(htmlPath, originalHtml, 'utf8');
    const intake = await intakeBridgeRequestToVault({
      vaultDir,
      request: {
        requestId: 'req_api_save_as_guard',
        type: 'registerHtmlAsset',
        createdAt: '2026-06-27T00:00:00.000Z',
        sourceAgent: 'codex',
        sourcePath: htmlPath,
        sourceHash: sha256(originalHtml),
        title: 'API Save As Guard',
      },
    });
    const existingCopy = path.join(vaultDir, 'exports', 'api-save-as-copy.html');
    await mkdir(path.dirname(existingCopy), { recursive: true });
    await writeFile(existingCopy, '<html><body><h1>Existing Copy</h1></body></html>', 'utf8');

    await request(app.server)
      .post('/api/vault/write-decision')
      .send({ assetId: intake.asset.id, editedHtml, decision: { action: 'save-as', saveAsPath: existingCopy } })
      .expect(409);
    expect(await readFile(existingCopy, 'utf8')).toContain('Existing Copy');

    await request(app.server)
      .post('/api/vault/write-decision')
      .send({
        assetId: intake.asset.id,
        editedHtml,
        decision: { action: 'save-as', saveAsPath: path.join(linkedDir, 'escaped-copy.html') },
      })
      .expect(400);
    await expect(access(path.join(outsideDir, 'escaped-copy.html'))).rejects.toThrow();
  });

  it('lists, diffs, snapshots, and rolls back Vault asset versions through the local API', async () => {
    const vaultDir = path.join(tempDir, 'vault');
    const aiDir = path.join(vaultDir, 'imports', 'ai');
    const htmlPath = path.join(aiDir, 'api-versioned.html');
    const firstHtml = '<!doctype html><title>V1</title><main><h1>Versioned</h1><p>Alpha</p></main>';
    const secondHtml = '<!doctype html><title>V2</title><main><h1>Versioned</h1><p>Beta</p><section>New</section></main>';
    await mkdir(aiDir, { recursive: true });
    await writeFile(htmlPath, firstHtml, 'utf8');
    const intake = await intakeBridgeRequestToVault({
      vaultDir,
      request: {
        requestId: 'req_api_versions',
        type: 'registerHtmlAsset',
        createdAt: '2026-06-27T00:00:00.000Z',
        sourceAgent: 'codex',
        sourcePath: htmlPath,
        sourceHash: sha256(firstHtml),
        title: 'API Versioned',
      },
    });

    const baseline = await request(app.server).get(`/api/vault/assets/${intake.asset.id}/versions`).expect(200);
    expect(baseline.body.snapshots).toHaveLength(1);
    expect(baseline.body.snapshots[0]).toMatchObject({
      assetId: intake.asset.id,
      reason: 'baseline',
      contentHash: sha256(firstHtml),
    });
    expect(baseline.body.snapshots[0]).not.toHaveProperty('contentPath');

    await writeFile(htmlPath, secondHtml, 'utf8');
    const snapshot = await request(app.server)
      .post(`/api/vault/assets/${intake.asset.id}/versions/snapshot`)
      .send({ reason: 'external-agent-edit' })
      .expect(201);
    expect(snapshot.body).toMatchObject({
      assetId: intake.asset.id,
      reason: 'external-agent-edit',
      contentHash: sha256(secondHtml),
    });

    const versions = await request(app.server).get(`/api/vault/assets/${intake.asset.id}/versions`).expect(200);
    expect(versions.body.snapshots.map((item: { reason: string }) => item.reason)).toEqual(['baseline', 'external-agent-edit']);

    const diff = await request(app.server)
      .get(`/api/vault/assets/${intake.asset.id}/versions/diff`)
      .query({
        from: baseline.body.snapshots[0].snapshotId,
        to: snapshot.body.snapshotId,
      })
      .expect(200);
    expect(diff.body.source.added).toContain('<p>Beta</p>');
    expect(diff.body.content.added).toContain('Beta');
    expect(diff.body.domSummary.addedTags).toContain('section');
    expect(diff.body.domSummary.changedTitle).toEqual({ from: 'V1', to: 'V2' });

    const rollback = await request(app.server)
      .post(`/api/vault/assets/${intake.asset.id}/versions/rollback`)
      .send({ snapshotId: baseline.body.snapshots[0].snapshotId })
      .expect(200);
    expect(rollback.body).toMatchObject({
      assetId: intake.asset.id,
      snapshotId: baseline.body.snapshots[0].snapshotId,
      restoredHash: sha256(firstHtml),
    });
    expect(await readFile(htmlPath, 'utf8')).toBe(firstHtml);
  });

  it('rejects unsafe Vault version asset IDs before reading version files', async () => {
    await request(app.server).get('/api/vault/assets/..%2Foutside/versions').expect(400);
    await request(app.server).get('/api/vault/assets/..%2Foutside/versions/diff?from=snap_a&to=snap_b').expect(400);
  });

  it('checks, starts, and stops registered local services by Vault asset id', async () => {
    const vaultDir = path.join(tempDir, 'vault');
    const port = await getAvailablePort();
    const fixture = await createFixtureService(port);
    await registerWebService(path.join(vaultDir, '.htmlvault', 'services.json'), {
      id: 'svc_api_fixture',
      title: 'API Fixture Service',
      cwd: fixture.cwd,
      startCommand: `node ${path.join(fixture.cwd, 'server.mjs')}`,
      url: `http://127.0.0.1:${port}`,
      port,
      healthCheckUrl: `http://127.0.0.1:${port}/health`,
      envHints: [],
      logPath: fixture.logPath,
    });
    const intake = await intakeBridgeRequestToVault({
      vaultDir,
      request: {
        requestId: 'req_api_service_runtime',
        type: 'registerWebService',
        createdAt: '2026-06-27T00:00:00.000Z',
        service: {
          title: 'API Fixture Service',
          cwd: fixture.cwd,
          startCommand: `node ${path.join(fixture.cwd, 'server.mjs')}`,
          url: `http://127.0.0.1:${port}`,
          healthCheckUrl: `http://127.0.0.1:${port}/health`,
          logPath: fixture.logPath,
          envHints: [],
        },
      },
    });

    const health = await request(app.server).get(`/api/services/${intake.asset.id}/health`).expect(200);
    expect(health.body).toMatchObject({
      status: 'stopped',
      serviceId: 'svc_api_fixture',
      cwd: fixture.cwd,
      logPath: fixture.logPath,
    });

    const started = await request(app.server).post(`/api/services/${intake.asset.id}/start`).expect(200);
    expect(started.body.status).toBe('running');

    const running = await request(app.server).get(`/api/services/${intake.asset.id}/health`).expect(200);
    expect(running.body.status).toBe('running');

    const stopped = await request(app.server).post(`/api/services/${intake.asset.id}/stop`).expect(200);
    expect(stopped.body.status).toBe('stopped');
  });

  it('scans registered Vault HTML assets for integrity risks through the local API', async () => {
    const vaultDir = path.join(tempDir, 'vault');
    const aiDir = path.join(vaultDir, 'imports', 'ai');
    const htmlPath = path.join(aiDir, 'asset-risk.html');
    const html = [
      '<!doctype html>',
      '<link rel="stylesheet" href="https://cdn.example.com/theme.css">',
      '<script>console.log("inline")</script>',
      '<img src="./missing.png" alt="missing">',
      '<a href="file:///Users/example/private.html">private</a>',
    ].join('\n');
    await mkdir(aiDir, { recursive: true });
    await writeFile(htmlPath, html, 'utf8');
    const before = sha256(html);
    const intake = await intakeBridgeRequestToVault({
      vaultDir,
      request: {
        requestId: 'req_api_asset_integrity',
        type: 'registerHtmlAsset',
        createdAt: '2026-06-27T00:00:00.000Z',
        sourceAgent: 'codex',
        sourcePath: htmlPath,
        sourceHash: before,
        title: 'Asset Risk',
      },
    });

    const response = await request(app.server).get(`/api/assets/${intake.asset.id}/integrity`).expect(200);

    expect(response.body).toMatchObject({
      htmlPath,
      sourceHash: before,
      safeModeRequired: true,
      missingAssets: [{ kind: 'image', reference: './missing.png', resolvedPath: path.join(aiDir, 'missing.png') }],
      externalResources: [{ kind: 'stylesheet', reference: 'https://cdn.example.com/theme.css' }],
      dangerousScripts: [{ kind: 'inline-script', reason: 'Inline script execution is unsafe in static safe mode' }],
      unpublishableResources: [{ kind: 'link', reference: 'file:///Users/example/private.html', reason: 'file:// resources cannot be published' }],
    });
    expect(await readFile(htmlPath, 'utf8')).toBe(html);
  });
});
