import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VaultLibraryResponse } from '../../src/shared/types';
import type { InboxReadResult } from '../../bridge/inbox/jsonlInbox';

const fallbackLibrary: VaultLibraryResponse = {
  items: [],
  folders: [],
  availableFilters: {
    tags: [],
    sourceAgents: [],
    kinds: [],
  },
};

const fallbackInbox: InboxReadResult = {
  requests: [],
  invalidLines: [],
  skippedDuplicates: [],
};

const fallbackApi = vi.hoisted(() => ({
  listVaultLibrary: vi.fn(async () => fallbackLibrary),
  generateVaultThumbnails: vi.fn(async () => ({ ok: true, generatedCount: 0, skippedCount: 0, generated: [], skipped: [] })),
  getVaultAssetSource: vi.fn(async () => ({ assetId: 'asset_1', title: 'Asset', html: '<h1>Asset</h1>' })),
  listVaultVersions: vi.fn(async () => ({ assetId: 'asset_1', snapshots: [] })),
  createVaultVersionSnapshot: vi.fn(async () => ({ snapshotId: 'snap_1', reason: 'manual', createdAt: '2026-06-27T00:00:00.000Z' })),
  diffVaultVersions: vi.fn(async () => ({ fromSnapshotId: 'snap_a', toSnapshotId: 'snap_b', sourceDiff: '', contentDiff: '', domSummary: [] })),
  rollbackVaultVersion: vi.fn(async () => ({ assetId: 'asset_1', snapshotId: 'snap_1', restoredHash: 'sha256:test' })),
  checkVaultService: vi.fn(async () => ({ assetId: 'svc_1', status: 'running' })),
  startVaultService: vi.fn(async () => ({ assetId: 'svc_1', status: 'running' })),
  stopVaultService: vi.fn(async () => ({ assetId: 'svc_1', status: 'stopped' })),
  scanVaultAssetIntegrity: vi.fn(async () => ({ assetId: 'asset_1', status: 'ready', checkedAt: '2026-06-27T00:00:00.000Z', issues: [] })),
  exportVaultPackage: vi.fn(async () => ({
    assetId: 'asset_1',
    exportType: 'static-package',
    outputDir: '/Vault/export',
    indexPath: '/Vault/export/index.html',
    manifestPath: '/Vault/export/manifest.json',
    copiedAssets: [],
    sourceHash: 'sha256:test',
  })),
  exportVaultMarkdown: vi.fn(async () => ({ assetId: 'asset_1', exportType: 'markdown', outputPath: '/Vault/export/Asset.md', sourceHash: 'sha256:test' })),
  reviewVaultAssetWrite: vi.fn(async () => ({
    assetId: 'asset_1',
    status: 'changed',
    sourcePath: '/Vault/asset.html',
    sourceHashBefore: 'sha256:before',
    editedHash: 'sha256:after',
    editedHtml: '<h1>Edit</h1>',
    diff: '',
  })),
  applyVaultWriteDecision: vi.fn(async () => ({ assetId: 'asset_1', action: 'cancel', sourceHashAfter: 'sha256:before' })),
  listAgentInbox: vi.fn(async () => fallbackInbox),
  confirmAgentInboxRequest: vi.fn(async () => fallbackInbox),
  dismissAgentInboxRequest: vi.fn(async () => fallbackInbox),
  listNotes: vi.fn(async () => []),
  createNote: vi.fn(async () => ({
    id: 'note_1',
    title: 'Note',
    slug: 'note',
    fileName: 'note.html',
    createdAt: '2026-06-27T00:00:00.000Z',
    updatedAt: '2026-06-27T00:00:00.000Z',
    tags: [],
    archived: false,
  })),
  getNote: vi.fn(async () => ({
    id: 'note_1',
    title: 'Note',
    slug: 'note',
    fileName: 'note.html',
    createdAt: '2026-06-27T00:00:00.000Z',
    updatedAt: '2026-06-27T00:00:00.000Z',
    tags: [],
    archived: false,
    content: '<h1>Note</h1>',
  })),
  saveNoteContent: vi.fn(async () => ({
    id: 'note_1',
    title: 'Note',
    slug: 'note',
    fileName: 'note.html',
    createdAt: '2026-06-27T00:00:00.000Z',
    updatedAt: '2026-06-27T00:00:01.000Z',
    tags: [],
    archived: false,
  })),
  duplicateNote: vi.fn(async () => ({
    id: 'note_2',
    title: 'Note Copy',
    slug: 'note-copy',
    fileName: 'note-copy.html',
    createdAt: '2026-06-27T00:00:00.000Z',
    updatedAt: '2026-06-27T00:00:00.000Z',
    tags: [],
    archived: false,
  })),
  deleteNote: vi.fn(async () => undefined),
  aiStatus: vi.fn(async () => ({ configured: false, baseUrlSet: false })),
  runAiAction: vi.fn(async () => ({ result: '<p>AI</p>' })),
  organizeDiary: vi.fn(async () => ({ originalText: 'diary', styles: [] })),
}));

vi.mock('../../src/shared/api/client', () => ({
  apiClient: fallbackApi,
}));

describe('desktopBridge', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('lists Vault library through Tauri command when desktop invoke is available', async () => {
    const desktopLibrary: VaultLibraryResponse = {
      ...fallbackLibrary,
      folders: [{ path: 'agent-output', itemCount: 1 }],
    };
    const invoke = vi.fn(async () => desktopLibrary);
    vi.stubGlobal('__TAURI__', { core: { invoke } });

    const { desktopBridge } = await import('../../src/shared/desktopBridge');
    const result = await desktopBridge.listVaultLibrary({ q: 'agent', tag: 'ai' });

    expect(result).toBe(desktopLibrary);
    expect(invoke).toHaveBeenCalledWith('vault_list_library', { filters: { q: 'agent', tag: 'ai' } });
    expect(fallbackApi.listVaultLibrary).not.toHaveBeenCalled();
  });

  it('maps renderer operations to explicit desktop command names and payloads', async () => {
    const invoke = vi.fn(async (_command: string, payload?: unknown) => ({ commandPayload: payload }));
    vi.stubGlobal('__TAURI__', { core: { invoke } });

    const { desktopBridge } = await import('../../src/shared/desktopBridge');

    await desktopBridge.generateVaultThumbnails();
    expect(invoke).toHaveBeenLastCalledWith('vault_generate_thumbnails', undefined);

    await desktopBridge.getVaultAssetSource('asset_1');
    expect(invoke).toHaveBeenLastCalledWith('vault_get_asset_source', { assetId: 'asset_1' });

    await desktopBridge.createVaultVersionSnapshot('asset_1', 'external-agent-edit');
    expect(invoke).toHaveBeenLastCalledWith('vault_create_version_snapshot', { assetId: 'asset_1', reason: 'external-agent-edit' });

    await desktopBridge.diffVaultVersions('asset_1', 'snap_a', 'snap_b');
    expect(invoke).toHaveBeenLastCalledWith('vault_diff_versions', { assetId: 'asset_1', fromSnapshotId: 'snap_a', toSnapshotId: 'snap_b' });

    await desktopBridge.startVaultService('svc_1');
    expect(invoke).toHaveBeenLastCalledWith('service_start', { assetId: 'svc_1' });

    await desktopBridge.scanVaultAssetIntegrity('asset_1');
    expect(invoke).toHaveBeenLastCalledWith('asset_scan_integrity', { assetId: 'asset_1' });

    await desktopBridge.exportVaultPackage('asset_1');
    expect(invoke).toHaveBeenLastCalledWith('export_static_package', { assetId: 'asset_1' });

    await desktopBridge.reviewVaultAssetWrite('asset_1', '<h1>Edit</h1>');
    expect(invoke).toHaveBeenLastCalledWith('source_guard_review_write', { assetId: 'asset_1', editedHtml: '<h1>Edit</h1>' });

    await desktopBridge.applyVaultWriteDecision('asset_1', '<h1>Edit</h1>', { action: 'cancel' });
    expect(invoke).toHaveBeenLastCalledWith('source_guard_apply_write_decision', {
      assetId: 'asset_1',
      editedHtml: '<h1>Edit</h1>',
      decision: { action: 'cancel' },
    });

    await desktopBridge.listAgentInbox();
    expect(invoke).toHaveBeenLastCalledWith('inbox_list_requests', undefined);

    await desktopBridge.confirmAgentInboxRequest('inbox_1');
    expect(invoke).toHaveBeenLastCalledWith('inbox_confirm_request', { requestId: 'inbox_1' });

    await desktopBridge.dismissAgentInboxRequest('inbox_1');
    expect(invoke).toHaveBeenLastCalledWith('inbox_dismiss_request', { requestId: 'inbox_1' });

    await desktopBridge.createNote({ title: 'Note', content: '<h1>Note</h1>' });
    expect(invoke).toHaveBeenLastCalledWith('note_create', { input: { title: 'Note', content: '<h1>Note</h1>' } });

    await desktopBridge.runAiAction({ action: 'summarize', content: '<p>Text</p>' });
    expect(invoke).toHaveBeenLastCalledWith('ai_run_action', { input: { action: 'summarize', content: '<p>Text</p>' } });

    await desktopBridge.organizeDiary({ originalText: 'diary' });
    expect(invoke).toHaveBeenLastCalledWith('diary_organize', { input: { originalText: 'diary' } });
  });

  it('falls back to the HTTP API client when Tauri invoke is unavailable', async () => {
    const { desktopBridge } = await import('../../src/shared/desktopBridge');
    const filters = { sourceAgent: 'codex', kind: 'html-note' };

    await expect(desktopBridge.listVaultLibrary(filters)).resolves.toBe(fallbackLibrary);
    expect(fallbackApi.listVaultLibrary).toHaveBeenCalledWith(filters);

    await expect(desktopBridge.listAgentInbox()).resolves.toBe(fallbackInbox);
    expect(fallbackApi.listAgentInbox).toHaveBeenCalledTimes(1);
  });

  it('falls back to the HTTP API client when a transitional Tauri shell lacks a command', async () => {
    const invoke = vi.fn(async () => {
      throw new Error('unknown command vault_list_library');
    });
    vi.stubGlobal('__TAURI__', { core: { invoke } });

    const { desktopBridge } = await import('../../src/shared/desktopBridge');
    const filters = { folder: 'imports/ai' };

    await expect(desktopBridge.listVaultLibrary(filters)).resolves.toBe(fallbackLibrary);
    expect(invoke).toHaveBeenCalledWith('vault_list_library', { filters });
    expect(fallbackApi.listVaultLibrary).toHaveBeenCalledWith(filters);
  });

  it('keeps destructive note operations on the fallback client outside Tauri', async () => {
    const { desktopBridge } = await import('../../src/shared/desktopBridge');

    await expect(desktopBridge.deleteNote('note_1')).resolves.toBeUndefined();
    expect(fallbackApi.deleteNote).toHaveBeenCalledWith('note_1');
  });
});
