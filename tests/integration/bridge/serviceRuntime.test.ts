// @vitest-environment node

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createServiceRuntimeManager,
  registerWebService,
  readServiceRegistry,
} from '../../../bridge/service/runtime';

let tempDir: string;
let registryPath: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), 'html-native-service-'));
  registryPath = path.join(tempDir, '.htmlvault', 'services.json');
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function createFixtureServer(port: number): Promise<{ cwd: string; logPath: string }> {
  const cwd = path.join(tempDir, `server-${port}`);
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

describe('Service Registry and Runtime Manager', () => {
  it('registers service metadata with cwd, command, URL, health check, env hints, and log path', async () => {
    const service = await registerWebService(registryPath, {
      id: 'svc_metrics',
      title: 'Metrics Dashboard',
      cwd: '/Users/example/metrics',
      startCommand: 'npm run dev',
      stopCommand: 'npm run stop',
      url: 'http://127.0.0.1:5173',
      port: 5173,
      healthCheckUrl: 'http://127.0.0.1:5173/health',
      envHints: ['DEEPSEEK_API_KEY'],
      logPath: '/Users/example/metrics/.htmlvault/logs/service.log',
    });

    expect(service).toMatchObject({
      id: 'svc_metrics',
      cwd: '/Users/example/metrics',
      startCommand: 'npm run dev',
      healthCheckUrl: 'http://127.0.0.1:5173/health',
      envHints: ['DEEPSEEK_API_KEY'],
    });

    const registry = await readServiceRegistry(registryPath);
    expect(registry.services).toHaveLength(1);
    expect(registry.services[0]?.id).toBe('svc_metrics');
  });

  it('starts an app-managed service, passes health check, stops it, and restarts it', async () => {
    const port = 19631;
    const fixture = await createFixtureServer(port);
    await registerWebService(registryPath, {
      id: 'svc_fixture',
      title: 'Fixture Dashboard',
      cwd: fixture.cwd,
      startCommand: `node ${path.join(fixture.cwd, 'server.mjs')}`,
      url: `http://127.0.0.1:${port}`,
      port,
      healthCheckUrl: `http://127.0.0.1:${port}/health`,
      envHints: [],
      logPath: fixture.logPath,
    });

    const runtime = createServiceRuntimeManager(registryPath);

    const firstStart = await runtime.start('svc_fixture');
    expect(firstStart.status).toBe('running');
    expect(firstStart.startedByApp).toBe(true);

    const health = await runtime.health('svc_fixture');
    expect(health.status).toBe('running');

    const stopped = await runtime.stop('svc_fixture');
    expect(stopped.status).toBe('stopped');

    const secondStart = await runtime.start('svc_fixture');
    expect(secondStart.status).toBe('running');

    await runtime.stop('svc_fixture');
  });

  it('returns cwd, command, and log path when startup fails', async () => {
    await registerWebService(registryPath, {
      id: 'svc_fail',
      title: 'Failing Dashboard',
      cwd: tempDir,
      startCommand: 'node missing-file.mjs',
      url: 'http://127.0.0.1:19999',
      port: 19999,
      healthCheckUrl: 'http://127.0.0.1:19999/health',
      envHints: ['MISSING_TOKEN'],
      logPath: path.join(tempDir, 'failed.log'),
    });

    const runtime = createServiceRuntimeManager(registryPath);
    const result = await runtime.start('svc_fail', { timeoutMs: 250 });

    expect(result).toMatchObject({
      status: 'failed',
      cwd: tempDir,
      command: 'node missing-file.mjs',
      logPath: path.join(tempDir, 'failed.log'),
    });

    const log = await readFile(path.join(tempDir, 'failed.log'), 'utf8');
    expect(log).toContain('missing-file.mjs');
  });
});
