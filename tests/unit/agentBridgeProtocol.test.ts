import {
  agentInboxRequestSchema,
  htmlAssetRegistrationSchema,
  normalizeBridgeRequest,
  webServiceRegistrationSchema,
} from '../../bridge/shared/protocol';

describe('agent bridge protocol', () => {
  it('accepts an HTML asset registration with source hash and agent metadata', () => {
    const parsed = htmlAssetRegistrationSchema.parse({
      requestId: 'req-html-001',
      filePath: '/Users/example/work/report.html',
      sourceHash: 'sha256:abc123',
      title: 'AI Research Report',
      tags: ['ai', 'research'],
      sourceAgent: 'codex',
      summary: 'Generated market research report.',
    });

    expect(parsed.type).toBe('registerHtmlAsset');
    expect(parsed.tags).toEqual(['ai', 'research']);
    expect(parsed.sourceAgent).toBe('codex');
  });

  it('accepts a web service registration with runtime metadata', () => {
    const parsed = webServiceRegistrationSchema.parse({
      requestId: 'req-service-001',
      title: 'Local Dashboard',
      cwd: '/Users/example/dashboard',
      startCommand: 'npm run dev',
      stopCommand: 'npm run stop',
      url: 'http://127.0.0.1:5173',
      port: 5173,
      healthCheckUrl: 'http://127.0.0.1:5173/health',
      envHints: ['DEEPSEEK_API_KEY'],
      logPath: '/Users/example/dashboard/.htmlvault/logs/service.log',
    });

    expect(parsed.type).toBe('registerWebService');
    expect(parsed.service.port).toBe(5173);
    expect(parsed.service.envHints).toContain('DEEPSEEK_API_KEY');
  });

  it('normalizes inbox requests with stable dedupe keys', () => {
    const normalized = normalizeBridgeRequest({
      requestId: ' req-html-002 ',
      type: 'registerHtmlAsset',
      createdAt: '2026-06-26T12:00:00.000Z',
      sourcePath: '/Users/example/work/page.html',
      sourceHash: 'sha256:def456',
      title: 'Page',
      tags: [' HTML ', 'AI'],
    });

    expect(normalized.requestId).toBe('req-html-002');
    expect(normalized.dedupeKey).toBe('registerHtmlAsset:sha256:def456');
    expect(normalized.tags).toEqual(['html', 'ai']);
  });

  it('rejects missing request IDs and unsupported file types', () => {
    expect(() =>
      htmlAssetRegistrationSchema.parse({
        requestId: '',
        filePath: '/Users/example/work/report.html',
        sourceHash: 'sha256:abc123',
      }),
    ).toThrow();

    expect(() =>
      htmlAssetRegistrationSchema.parse({
        requestId: 'req-bad-ext',
        filePath: '/Users/example/work/report.pdf',
        sourceHash: 'sha256:abc123',
      }),
    ).toThrow();
  });

  it('rejects unsafe service commands that are not explicit shell commands', () => {
    expect(() =>
      webServiceRegistrationSchema.parse({
        requestId: 'req-service-unsafe',
        title: 'Unsafe',
        cwd: '/Users/example/dashboard',
        startCommand: '',
        url: 'http://127.0.0.1:5173',
      }),
    ).toThrow();
  });

  it('parses generic inbox requests for supported bridge types', () => {
    const parsed = agentInboxRequestSchema.parse({
      requestId: 'req-import-001',
      type: 'importExisting',
      createdAt: '2026-06-26T12:00:00.000Z',
      sourcePath: '/Users/example/old-notes',
      metadata: { mode: 'read-only-scan' },
    });

    expect(parsed.type).toBe('importExisting');
    expect(parsed.metadata).toEqual({ mode: 'read-only-scan' });
  });
});
