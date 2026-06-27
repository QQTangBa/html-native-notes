import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import type { VaultLibraryResponse } from '../../src/shared/types';

const note = {
  id: 'note_abc',
  title: 'First note',
  slug: 'first-note',
  fileName: 'first-note.html',
  createdAt: '2026-06-26T00:00:00.000Z',
  updatedAt: '2026-06-26T00:00:00.000Z',
  tags: [],
  archived: false,
};

let vaultLibrary: VaultLibraryResponse;

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vaultLibrary = {
    items: [],
    folders: [],
    availableFilters: {
      tags: [],
      sourceAgents: [],
      kinds: [],
    },
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url === '/api/notes' && method === 'GET') {
        return jsonResponse([]);
      }

      if (url === '/api/config/ai/status') {
        return jsonResponse({ configured: false, baseUrlSet: false });
      }

      if (url === '/api/vault/library') {
        return jsonResponse(vaultLibrary);
      }

      if (url === '/api/notes' && method === 'POST') {
        return jsonResponse(note, { status: 201 });
      }

      if (url === '/api/notes/note_abc') {
        return jsonResponse({ ...note, content: '<h1>First note</h1>' });
      }

      if (url === '/api/notes/note_abc/content' && method === 'PUT') {
        return jsonResponse({ ...note, updatedAt: '2026-06-26T00:00:01.000Z' });
      }

      return jsonResponse({ error: { code: 'NOT_FOUND', message: url } }, { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App workspace', () => {
  it('renders the editor workspace and AI status', async () => {
    render(<App />);

    expect(await screen.findByTestId('workspace-shell')).toBeInTheDocument();
    expect(screen.getByLabelText('Note title')).toBeInTheDocument();
    expect(await screen.findByText('AI 未配置')).toBeInTheDocument();
  });

  it('creates a note and opens it in the editor', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText('Note title'), { target: { value: 'First note' } });
    fireEvent.click(screen.getByRole('button', { name: /create note/i }));

    expect(await screen.findByText('First note')).toBeInTheDocument();
    const editor = (await screen.findByLabelText('HTML source')) as HTMLTextAreaElement;
    expect(editor.value).toContain('First note');
  });

  it('updates the preview when source changes', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText('Note title'), { target: { value: 'First note' } });
    fireEvent.click(screen.getByRole('button', { name: /create note/i }));

    const editor = await screen.findByLabelText('HTML source');
    fireEvent.change(editor, { target: { value: '<article><h1>Changed</h1><p>Preview text</p></article>' } });

    await waitFor(() => {
      const preview = screen.getByTitle('HTML preview') as HTMLIFrameElement;
      expect(preview.srcdoc).toContain('Preview text');
    });
  });

  it('loads Vault assets into the desktop Vault home', async () => {
    vaultLibrary = {
      items: [
        {
          id: 'asset_market',
          kind: 'html-note',
          title: 'Agent Market Map',
          source: 'bridge',
          sourceAgent: 'codex',
          sourcePath: '/Vault/imports/ai/market.html',
          relativeSourcePath: 'imports/ai/market.html',
          folderPath: 'imports/ai',
          tags: ['market', 'ai'],
          summary: 'Agent generated market map',
          updatedAt: '2026-06-27T00:00:00.000Z',
          thumbnail: {
            status: 'pending',
            path: '/Vault/.htmlvault/thumbnails/asset_market.png',
          },
        },
      ],
      folders: [{ path: 'imports/ai', itemCount: 1 }],
      availableFilters: {
        tags: ['ai', 'market'],
        sourceAgents: ['codex'],
        kinds: ['html-note'],
      },
    };

    render(<App />);

    expect(await screen.findByText('Agent Market Map')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search Vault' })).toBeInTheDocument();
  });

  it('generates pending Vault thumbnails from the desktop toolbar and refreshes the library', async () => {
    vaultLibrary = {
      items: [
        {
          id: 'asset_market',
          kind: 'html-note',
          title: 'Agent Market Map',
          source: 'bridge',
          sourceAgent: 'codex',
          sourcePath: '/Vault/imports/ai/market.html',
          relativeSourcePath: 'imports/ai/market.html',
          folderPath: 'imports/ai',
          tags: ['market', 'ai'],
          summary: 'Agent generated market map',
          updatedAt: '2026-06-27T00:00:00.000Z',
          thumbnail: {
            status: 'pending',
            path: '/Vault/.htmlvault/thumbnails/asset_market.png',
          },
        },
      ],
      folders: [{ path: 'imports/ai', itemCount: 1 }],
      availableFilters: {
        tags: ['ai', 'market'],
        sourceAgents: ['codex'],
        kinds: ['html-note'],
      },
    };

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url === '/api/vault/thumbnails/generate' && method === 'POST') {
        vaultLibrary = {
          ...vaultLibrary,
          items: vaultLibrary.items.map((item) => ({
            ...item,
            thumbnail: { ...item.thumbnail, status: 'ready' },
          })),
        };
        return jsonResponse({
          ok: true,
          generatedCount: 1,
          skippedCount: 0,
          generated: [{ assetId: 'asset_market', path: '/Vault/.htmlvault/thumbnails/asset_market.png' }],
          skipped: [],
        });
      }

      if (url === '/api/vault/library') {
        return jsonResponse(vaultLibrary);
      }

      if (url === '/api/notes' && method === 'GET') {
        return jsonResponse([]);
      }

      if (url === '/api/config/ai/status') {
        return jsonResponse({ configured: false, baseUrlSet: false });
      }

      return jsonResponse({ error: { code: 'NOT_FOUND', message: url } }, { status: 404 });
    });

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Generate 1 pending thumbnail' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/vault/thumbnails/generate', { method: 'POST' });
      expect(screen.getByText('Thumbnail ready')).toBeInTheDocument();
    });
  });

  it('checks, starts, and stops Vault services from the service card', async () => {
    vaultLibrary = {
      items: [
        {
          id: 'asset_service',
          kind: 'service',
          title: 'Local Dashboard',
          source: 'bridge',
          sourceAgent: 'codex',
          sourcePath: '/Vault/services/local-dashboard',
          relativeSourcePath: 'services/local-dashboard',
          folderPath: 'services',
          tags: ['service'],
          summary: 'Local service',
          updatedAt: '2026-06-27T00:00:00.000Z',
          thumbnail: {
            status: 'ready',
            path: '/Vault/.htmlvault/thumbnails/asset_service.png',
          },
        },
      ],
      folders: [{ path: 'services', itemCount: 1 }],
      availableFilters: {
        tags: ['service'],
        sourceAgents: ['codex'],
        kinds: ['service'],
      },
    };
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url === '/api/vault/library') {
        return jsonResponse(vaultLibrary);
      }

      if (url === '/api/services/asset_service/health') {
        return jsonResponse({
          status: 'stopped',
          serviceId: 'svc_local',
          cwd: '/Vault/services/local-dashboard',
          command: 'npm run dev',
          logPath: '/Vault/services/local-dashboard/service.log',
          startedByApp: false,
        });
      }

      if (url === '/api/services/asset_service/start' && method === 'POST') {
        return jsonResponse({
          status: 'running',
          serviceId: 'svc_local',
          cwd: '/Vault/services/local-dashboard',
          command: 'npm run dev',
          logPath: '/Vault/services/local-dashboard/service.log',
          startedByApp: true,
        });
      }

      if (url === '/api/services/asset_service/stop' && method === 'POST') {
        return jsonResponse({
          status: 'stopped',
          serviceId: 'svc_local',
          cwd: '/Vault/services/local-dashboard',
          command: 'npm run dev',
          logPath: '/Vault/services/local-dashboard/service.log',
          startedByApp: false,
        });
      }

      if (url === '/api/notes' && method === 'GET') {
        return jsonResponse([]);
      }

      if (url === '/api/config/ai/status') {
        return jsonResponse({ configured: false, baseUrlSet: false });
      }

      return jsonResponse({ error: { code: 'NOT_FOUND', message: url } }, { status: 404 });
    });

    render(<App />);

    const serviceCard = await screen.findByTestId('vault-item-asset_service');
    fireEvent.click(within(serviceCard).getByRole('button', { name: 'Check service Local Dashboard' }));
    expect(await within(serviceCard).findByText('stopped')).toBeInTheDocument();

    fireEvent.click(within(serviceCard).getByRole('button', { name: 'Start service Local Dashboard' }));
    expect(await within(serviceCard).findByText('running')).toBeInTheDocument();

    fireEvent.click(within(serviceCard).getByRole('button', { name: 'Stop service Local Dashboard' }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/services/asset_service/stop', { method: 'POST' });
      expect(within(serviceCard).getByText('stopped')).toBeInTheDocument();
    });
  });

  it('opens a Vault HTML asset in the read-only preview pane', async () => {
    vaultLibrary = {
      items: [
        {
          id: 'asset_market',
          kind: 'html-note',
          title: 'Agent Market Map',
          source: 'bridge',
          sourceAgent: 'codex',
          sourcePath: '/Vault/imports/ai/market.html',
          relativeSourcePath: 'imports/ai/market.html',
          folderPath: 'imports/ai',
          tags: ['market', 'ai'],
          summary: 'Agent generated market map',
          updatedAt: '2026-06-27T00:00:00.000Z',
          thumbnail: {
            status: 'ready',
            path: '/Vault/.htmlvault/thumbnails/asset_market.png',
          },
        },
      ],
      folders: [{ path: 'imports/ai', itemCount: 1 }],
      availableFilters: {
        tags: ['ai', 'market'],
        sourceAgents: ['codex'],
        kinds: ['html-note'],
      },
    };

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url === '/api/vault/library') {
        return jsonResponse(vaultLibrary);
      }

      if (url === '/api/vault/assets/asset_market/source') {
        return jsonResponse({
          assetId: 'asset_market',
          title: 'Agent Market Map',
          sourcePath: '/Vault/imports/ai/market.html',
          sourceHashMatches: true,
          html: '<html><body><h1>Agent Preview</h1></body></html>',
        });
      }

      if (url === '/api/notes' && method === 'GET') {
        return jsonResponse([]);
      }

      if (url === '/api/config/ai/status') {
        return jsonResponse({ configured: false, baseUrlSet: false });
      }

      return jsonResponse({ error: { code: 'NOT_FOUND', message: url } }, { status: 404 });
    });

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Preview Agent Market Map' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/vault/assets/asset_market/source');
      expect(screen.getByTitle('Vault HTML preview')).toHaveAttribute('srcdoc', '<html><body><h1>Agent Preview</h1></body></html>');
    });
  });

  it('reviews a Vault preview edit and cancels the Source Guard write decision', async () => {
    vaultLibrary = {
      items: [
        {
          id: 'asset_market',
          kind: 'html-note',
          title: 'Agent Market Map',
          source: 'bridge',
          sourceAgent: 'codex',
          sourcePath: '/Vault/imports/ai/market.html',
          relativeSourcePath: 'imports/ai/market.html',
          folderPath: 'imports/ai',
          tags: ['market', 'ai'],
          summary: 'Agent generated market map',
          updatedAt: '2026-06-27T00:00:00.000Z',
          thumbnail: {
            status: 'ready',
            path: '/Vault/.htmlvault/thumbnails/asset_market.png',
          },
        },
      ],
      folders: [{ path: 'imports/ai', itemCount: 1 }],
      availableFilters: {
        tags: ['ai', 'market'],
        sourceAgents: ['codex'],
        kinds: ['html-note'],
      },
    };

    const originalHtml = '<html><body><h1>Agent Preview</h1><p>Original</p></body></html>';
    const editedHtml = '<html><body><h1>Agent Preview</h1><p>Edited</p></body></html>';
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url === '/api/vault/library') {
        return jsonResponse(vaultLibrary);
      }

      if (url === '/api/vault/assets/asset_market/source') {
        return jsonResponse({
          assetId: 'asset_market',
          title: 'Agent Market Map',
          sourcePath: '/Vault/imports/ai/market.html',
          sourceHashMatches: true,
          html: originalHtml,
        });
      }

      if (url === '/api/vault/assets/asset_market/write-review' && method === 'POST') {
        expect(JSON.parse(String(init?.body))).toEqual({ editedHtml });
        return jsonResponse({
          sourcePath: '/Vault/imports/ai/market.html',
          expectedSourceHash: 'abc123',
          originalHtml,
          editedHtml,
          status: 'changed',
          diff: '-<p>Original</p>\n+<p>Edited</p>',
        });
      }

      if (url === '/api/vault/write-decision' && method === 'POST') {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          assetId: 'asset_market',
          editedHtml,
          decision: { action: 'cancel' },
        });
        return jsonResponse({ action: 'cancel' });
      }

      if (url === '/api/notes' && method === 'GET') {
        return jsonResponse([]);
      }

      if (url === '/api/config/ai/status') {
        return jsonResponse({ configured: false, baseUrlSet: false });
      }

      return jsonResponse({ error: { code: 'NOT_FOUND', message: url } }, { status: 404 });
    });

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Preview Agent Market Map' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit preview HTML' }));
    fireEvent.change(screen.getByLabelText('Editable HTML draft'), { target: { value: editedHtml } });
    fireEvent.click(screen.getByRole('button', { name: 'Review changes' }));

    expect(await screen.findByRole('region', { name: 'Source Guard review' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel write' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/vault/write-decision',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('ignores a late Source Guard review after the user opens another preview asset', async () => {
    vaultLibrary = {
      items: [
        {
          id: 'asset_market',
          kind: 'html-note',
          title: 'Agent Market Map',
          source: 'bridge',
          sourceAgent: 'codex',
          sourcePath: '/Vault/imports/ai/market.html',
          relativeSourcePath: 'imports/ai/market.html',
          folderPath: 'imports/ai',
          tags: ['market', 'ai'],
          summary: 'Agent generated market map',
          updatedAt: '2026-06-27T00:00:00.000Z',
          thumbnail: {
            status: 'ready',
            path: '/Vault/.htmlvault/thumbnails/asset_market.png',
          },
        },
        {
          id: 'asset_revenue',
          kind: 'html-note',
          title: 'Revenue Dashboard',
          source: 'bridge',
          sourceAgent: 'codex',
          sourcePath: '/Vault/imports/ai/revenue.html',
          relativeSourcePath: 'imports/ai/revenue.html',
          folderPath: 'imports/ai',
          tags: ['finance'],
          summary: 'Revenue report',
          updatedAt: '2026-06-27T00:10:00.000Z',
          thumbnail: {
            status: 'ready',
            path: '/Vault/.htmlvault/thumbnails/asset_revenue.png',
          },
        },
      ],
      folders: [{ path: 'imports/ai', itemCount: 2 }],
      availableFilters: {
        tags: ['ai', 'finance', 'market'],
        sourceAgents: ['codex'],
        kinds: ['html-note'],
      },
    };

    const originalHtml = '<html><body><h1>Agent Preview</h1><p>Original</p></body></html>';
    const editedHtml = '<html><body><h1>Agent Preview</h1><p>Edited</p></body></html>';
    const lateReview = deferred<Response>();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url === '/api/vault/library') {
        return jsonResponse(vaultLibrary);
      }

      if (url === '/api/vault/assets/asset_market/source') {
        return jsonResponse({
          assetId: 'asset_market',
          title: 'Agent Market Map',
          sourcePath: '/Vault/imports/ai/market.html',
          sourceHashMatches: true,
          html: originalHtml,
        });
      }

      if (url === '/api/vault/assets/asset_revenue/source') {
        return jsonResponse({
          assetId: 'asset_revenue',
          title: 'Revenue Dashboard',
          sourcePath: '/Vault/imports/ai/revenue.html',
          sourceHashMatches: true,
          html: '<html><body><h1>Revenue Preview</h1></body></html>',
        });
      }

      if (url === '/api/vault/assets/asset_market/write-review' && method === 'POST') {
        return lateReview.promise;
      }

      if (url === '/api/notes' && method === 'GET') {
        return jsonResponse([]);
      }

      if (url === '/api/config/ai/status') {
        return jsonResponse({ configured: false, baseUrlSet: false });
      }

      return jsonResponse({ error: { code: 'NOT_FOUND', message: url } }, { status: 404 });
    });

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Preview Agent Market Map' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit preview HTML' }));
    fireEvent.change(screen.getByLabelText('Editable HTML draft'), { target: { value: editedHtml } });
    fireEvent.click(screen.getByRole('button', { name: 'Review changes' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Preview Revenue Dashboard' }));

    await waitFor(() => {
      expect(screen.getByTitle('Vault HTML preview')).toHaveAttribute('srcdoc', '<html><body><h1>Revenue Preview</h1></body></html>');
    });

    lateReview.resolve(
      jsonResponse({
        sourcePath: '/Vault/imports/ai/market.html',
        expectedSourceHash: 'abc123',
        originalHtml,
        editedHtml,
        status: 'changed',
        diff: '-<p>Original</p>\n+<p>Edited</p>',
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/vault/assets/asset_market/write-review', expect.objectContaining({ method: 'POST' }));
    });
    expect(screen.queryByRole('region', { name: 'Source Guard review' })).not.toBeInTheDocument();
    expect(screen.getByTitle('Vault HTML preview')).toHaveAttribute('srcdoc', '<html><body><h1>Revenue Preview</h1></body></html>');
  });

  it('loads Vault versions, compares the latest snapshots, and rolls back a selected snapshot', async () => {
    vaultLibrary = {
      items: [
        {
          id: 'asset_market',
          kind: 'html-note',
          title: 'Agent Market Map',
          source: 'bridge',
          sourceAgent: 'codex',
          sourcePath: '/Vault/imports/ai/market.html',
          relativeSourcePath: 'imports/ai/market.html',
          folderPath: 'imports/ai',
          tags: ['market', 'ai'],
          summary: 'Agent generated market map',
          updatedAt: '2026-06-27T00:00:00.000Z',
          thumbnail: {
            status: 'ready',
            path: '/Vault/.htmlvault/thumbnails/asset_market.png',
          },
        },
      ],
      folders: [{ path: 'imports/ai', itemCount: 1 }],
      availableFilters: {
        tags: ['ai', 'market'],
        sourceAgents: ['codex'],
        kinds: ['html-note'],
      },
    };
    const snapshots = [
      {
        snapshotId: 'snap_base',
        assetId: 'asset_market',
        reason: 'baseline',
        createdAt: '2026-06-27T00:00:00.000Z',
        contentHash: 'sha256:base',
      },
      {
        snapshotId: 'snap_external',
        assetId: 'asset_market',
        reason: 'external-agent-edit',
        createdAt: '2026-06-27T00:05:00.000Z',
        contentHash: 'sha256:external',
      },
    ];
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url === '/api/vault/library') {
        return jsonResponse(vaultLibrary);
      }

      if (url === '/api/vault/assets/asset_market/source') {
        return jsonResponse({
          assetId: 'asset_market',
          title: 'Agent Market Map',
          sourcePath: '/Vault/imports/ai/market.html',
          sourceHashMatches: true,
          html: '<html><body><h1>Agent Preview</h1><p>Beta</p></body></html>',
        });
      }

      if (url === '/api/vault/assets/asset_market/versions') {
        return jsonResponse({ snapshots });
      }

      if (url === '/api/vault/assets/asset_market/versions/diff?from=snap_base&to=snap_external') {
        return jsonResponse({
          source: { added: ['<p>Beta</p>'], removed: ['<p>Alpha</p>'] },
          content: { added: ['Beta'], removed: ['Alpha'] },
          domSummary: { addedTags: ['section'], removedTags: [], changedTitle: { from: 'V1', to: 'V2' } },
        });
      }

      if (url === '/api/vault/assets/asset_market/versions/rollback' && method === 'POST') {
        expect(JSON.parse(String(init?.body))).toEqual({ snapshotId: 'snap_base' });
        return jsonResponse({ assetId: 'asset_market', snapshotId: 'snap_base', restoredHash: 'sha256:base' });
      }

      if (url === '/api/notes' && method === 'GET') {
        return jsonResponse([]);
      }

      if (url === '/api/config/ai/status') {
        return jsonResponse({ configured: false, baseUrlSet: false });
      }

      return jsonResponse({ error: { code: 'NOT_FOUND', message: url } }, { status: 404 });
    });

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Preview Agent Market Map' }));

    expect(await screen.findByRole('region', { name: 'Version timeline' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Compare latest versions' }));
    expect(await screen.findByText('+<p>Beta</p>')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Rollback to baseline' }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/vault/assets/asset_market/versions/rollback',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/vault/assets/asset_market/source');
  });

  it('ignores a late version diff after the user starts opening another preview asset', async () => {
    vaultLibrary = {
      items: [
        {
          id: 'asset_market',
          kind: 'html-note',
          title: 'Agent Market Map',
          source: 'bridge',
          sourceAgent: 'codex',
          sourcePath: '/Vault/imports/ai/market.html',
          relativeSourcePath: 'imports/ai/market.html',
          folderPath: 'imports/ai',
          tags: ['market', 'ai'],
          summary: 'Agent generated market map',
          updatedAt: '2026-06-27T00:00:00.000Z',
          thumbnail: {
            status: 'ready',
            path: '/Vault/.htmlvault/thumbnails/asset_market.png',
          },
        },
        {
          id: 'asset_revenue',
          kind: 'html-note',
          title: 'Revenue Dashboard',
          source: 'bridge',
          sourceAgent: 'codex',
          sourcePath: '/Vault/imports/ai/revenue.html',
          relativeSourcePath: 'imports/ai/revenue.html',
          folderPath: 'imports/ai',
          tags: ['finance'],
          summary: 'Revenue report',
          updatedAt: '2026-06-27T00:10:00.000Z',
          thumbnail: {
            status: 'ready',
            path: '/Vault/.htmlvault/thumbnails/asset_revenue.png',
          },
        },
      ],
      folders: [{ path: 'imports/ai', itemCount: 2 }],
      availableFilters: {
        tags: ['ai', 'finance', 'market'],
        sourceAgents: ['codex'],
        kinds: ['html-note'],
      },
    };
    const marketSnapshots = [
      {
        snapshotId: 'snap_base',
        assetId: 'asset_market',
        reason: 'baseline',
        createdAt: '2026-06-27T00:00:00.000Z',
        contentHash: 'sha256:base',
      },
      {
        snapshotId: 'snap_external',
        assetId: 'asset_market',
        reason: 'external-agent-edit',
        createdAt: '2026-06-27T00:05:00.000Z',
        contentHash: 'sha256:external',
      },
    ];
    const lateDiff = deferred<Response>();
    const delayedRevenueSource = deferred<Response>();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === '/api/vault/library') {
        return jsonResponse(vaultLibrary);
      }

      if (url === '/api/vault/assets/asset_market/source') {
        return jsonResponse({
          assetId: 'asset_market',
          title: 'Agent Market Map',
          sourcePath: '/Vault/imports/ai/market.html',
          sourceHashMatches: true,
          html: '<html><body><h1>Agent Preview</h1><p>Beta</p></body></html>',
        });
      }

      if (url === '/api/vault/assets/asset_revenue/source') {
        return delayedRevenueSource.promise;
      }

      if (url === '/api/vault/assets/asset_market/versions') {
        return jsonResponse({ snapshots: marketSnapshots });
      }

      if (url === '/api/vault/assets/asset_revenue/versions') {
        return jsonResponse({ snapshots: [] });
      }

      if (url === '/api/vault/assets/asset_market/versions/diff?from=snap_base&to=snap_external') {
        return lateDiff.promise;
      }

      if (url === '/api/notes') {
        return jsonResponse([]);
      }

      if (url === '/api/config/ai/status') {
        return jsonResponse({ configured: false, baseUrlSet: false });
      }

      return jsonResponse({ error: { code: 'NOT_FOUND', message: url } }, { status: 404 });
    });

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Preview Agent Market Map' }));
    expect(await screen.findByRole('region', { name: 'Version timeline' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Compare latest versions' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Preview Revenue Dashboard' }));

    lateDiff.resolve(
      jsonResponse({
        source: { added: ['<p>Beta</p>'], removed: ['<p>Alpha</p>'] },
        content: { added: ['Beta'], removed: ['Alpha'] },
        domSummary: { addedTags: ['section'], removedTags: [], changedTitle: { from: 'V1', to: 'V2' } },
      }),
    );
    delayedRevenueSource.resolve(
      jsonResponse({
        assetId: 'asset_revenue',
        title: 'Revenue Dashboard',
        sourcePath: '/Vault/imports/ai/revenue.html',
        sourceHashMatches: true,
        html: '<html><body><h1>Revenue Preview</h1></body></html>',
      }),
    );

    await waitFor(() => {
      expect(screen.getByTitle('Vault HTML preview')).toHaveAttribute('srcdoc', '<html><body><h1>Revenue Preview</h1></body></html>');
    });
    expect(screen.queryByText('+<p>Beta</p>')).not.toBeInTheDocument();
  });
});
