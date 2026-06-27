import type {
  AiActionRequest,
  AiActionResponse,
  NoteMeta,
  NoteRecord,
  SafeAiStatus,
  VaultAssetIntegrityReport,
  VaultAssetSourceResponse,
  VaultLibraryResponse,
  VaultServiceRuntimeState,
  VaultThumbnailGenerationResponse,
  VaultVersionDiff,
  VaultVersionRollbackResponse,
  VaultVersionSnapshot,
  VaultVersionsResponse,
  VaultWriteDecision,
  VaultWriteDecisionResult,
  VaultWriteReview,
} from '../types';

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as T | { error?: { message?: string } } | null;

  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && body.error?.message
        ? body.error.message
        : `Request failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  return body as T;
}

export const apiClient = {
  async listVaultLibrary(filters: { q?: string; tag?: string; sourceAgent?: string; kind?: string; folder?: string } = {}): Promise<VaultLibraryResponse> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) {
        params.set(key, value);
      }
    }
    const suffix = params.size ? `?${params.toString()}` : '';
    return parseResponse<VaultLibraryResponse>(await fetch(`/api/vault/library${suffix}`));
  },

  async generateVaultThumbnails(): Promise<VaultThumbnailGenerationResponse> {
    return parseResponse<VaultThumbnailGenerationResponse>(await fetch('/api/vault/thumbnails/generate', { method: 'POST' }));
  },

  async getVaultAssetSource(assetId: string): Promise<VaultAssetSourceResponse> {
    return parseResponse<VaultAssetSourceResponse>(await fetch(`/api/vault/assets/${encodeURIComponent(assetId)}/source`));
  },

  async listVaultVersions(assetId: string): Promise<VaultVersionsResponse> {
    return parseResponse<VaultVersionsResponse>(await fetch(`/api/vault/assets/${encodeURIComponent(assetId)}/versions`));
  },

  async createVaultVersionSnapshot(assetId: string, reason: string): Promise<VaultVersionSnapshot> {
    return parseResponse<VaultVersionSnapshot>(
      await fetch(`/api/vault/assets/${encodeURIComponent(assetId)}/versions/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      }),
    );
  },

  async diffVaultVersions(assetId: string, fromSnapshotId: string, toSnapshotId: string): Promise<VaultVersionDiff> {
    const params = new URLSearchParams({ from: fromSnapshotId, to: toSnapshotId });
    return parseResponse<VaultVersionDiff>(await fetch(`/api/vault/assets/${encodeURIComponent(assetId)}/versions/diff?${params.toString()}`));
  },

  async rollbackVaultVersion(assetId: string, snapshotId: string): Promise<VaultVersionRollbackResponse> {
    return parseResponse<VaultVersionRollbackResponse>(
      await fetch(`/api/vault/assets/${encodeURIComponent(assetId)}/versions/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshotId }),
      }),
    );
  },

  async checkVaultService(assetId: string): Promise<VaultServiceRuntimeState> {
    return parseResponse<VaultServiceRuntimeState>(await fetch(`/api/services/${encodeURIComponent(assetId)}/health`));
  },

  async startVaultService(assetId: string): Promise<VaultServiceRuntimeState> {
    return parseResponse<VaultServiceRuntimeState>(await fetch(`/api/services/${encodeURIComponent(assetId)}/start`, { method: 'POST' }));
  },

  async stopVaultService(assetId: string): Promise<VaultServiceRuntimeState> {
    return parseResponse<VaultServiceRuntimeState>(await fetch(`/api/services/${encodeURIComponent(assetId)}/stop`, { method: 'POST' }));
  },

  async scanVaultAssetIntegrity(assetId: string): Promise<VaultAssetIntegrityReport> {
    return parseResponse<VaultAssetIntegrityReport>(await fetch(`/api/assets/${encodeURIComponent(assetId)}/integrity`));
  },

  async reviewVaultAssetWrite(assetId: string, editedHtml: string): Promise<VaultWriteReview> {
    return parseResponse<VaultWriteReview>(
      await fetch(`/api/vault/assets/${encodeURIComponent(assetId)}/write-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editedHtml }),
      }),
    );
  },

  async applyVaultWriteDecision(assetId: string, editedHtml: string, decision: VaultWriteDecision): Promise<VaultWriteDecisionResult> {
    return parseResponse<VaultWriteDecisionResult>(
      await fetch('/api/vault/write-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, editedHtml, decision }),
      }),
    );
  },

  async listNotes(): Promise<NoteMeta[]> {
    return parseResponse<NoteMeta[]>(await fetch('/api/notes'));
  },

  async createNote(input: { title: string; content?: string; tags?: string[] }): Promise<NoteMeta> {
    return parseResponse<NoteMeta>(
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    );
  },

  async getNote(id: string): Promise<NoteRecord> {
    return parseResponse<NoteRecord>(await fetch(`/api/notes/${id}`));
  },

  async saveNoteContent(id: string, content: string): Promise<NoteMeta> {
    return parseResponse<NoteMeta>(
      await fetch(`/api/notes/${id}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      }),
    );
  },

  async duplicateNote(id: string): Promise<NoteMeta> {
    return parseResponse<NoteMeta>(await fetch(`/api/notes/${id}/duplicate`, { method: 'POST' }));
  },

  async deleteNote(id: string): Promise<void> {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' }).then((response) => {
      if (!response.ok) {
        throw new Error(`Delete failed with HTTP ${response.status}`);
      }
    });
  },

  async aiStatus(): Promise<SafeAiStatus> {
    return parseResponse<SafeAiStatus>(await fetch('/api/config/ai/status'));
  },

  async runAiAction(input: AiActionRequest): Promise<AiActionResponse> {
    return parseResponse<AiActionResponse>(
      await fetch('/api/ai/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    );
  },
};
