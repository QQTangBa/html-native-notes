import { apiClient } from './api/client';
import type {
  AgentInboxResponse,
  AiActionRequest,
  AiActionResponse,
  DiaryOrganizationRequest,
  DiaryOrganizationResponse,
  NoteMeta,
  NoteRecord,
  SafeAiStatus,
  VaultAssetIntegrityReport,
  VaultMarkdownExportResponse,
  VaultAssetSourceResponse,
  VaultLibraryResponse,
  VaultServiceRuntimeState,
  VaultStaticPublishResponse,
  VaultStaticPackageExportResponse,
  VaultThumbnailGenerationResponse,
  VaultVersionDiff,
  VaultVersionRollbackResponse,
  VaultVersionSnapshot,
  VaultVersionsResponse,
  VaultWriteDecision,
  VaultWriteDecisionResult,
  VaultWriteReview,
} from './types';

type VaultLibraryFilters = { q?: string; tag?: string; sourceAgent?: string; kind?: string; folder?: string };
type TauriInvoke = <T>(command: string, payload?: Record<string, unknown>) => Promise<T>;
type TauriGlobal = typeof globalThis & {
  __TAURI__?: {
    core?: {
      invoke?: TauriInvoke;
    };
  };
};

function getDesktopInvoke(): TauriInvoke | undefined {
  return (globalThis as TauriGlobal).__TAURI__?.core?.invoke;
}

function isMissingDesktopCommand(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /unknown command|command not found|not registered/i.test(message);
}

async function invokeOrFallback<T>(command: string, payload: Record<string, unknown> | undefined, fallback: () => Promise<T>): Promise<T> {
  const invoke = getDesktopInvoke();
  if (invoke) {
    try {
      return await invoke<T>(command, payload);
    } catch (error) {
      if (!isMissingDesktopCommand(error)) {
        throw error;
      }
    }
  }

  return fallback();
}

export const desktopBridge = {
  listVaultLibrary(filters: VaultLibraryFilters = {}): Promise<VaultLibraryResponse> {
    return invokeOrFallback('vault_list_library', { filters }, () => apiClient.listVaultLibrary(filters));
  },

  generateVaultThumbnails(): Promise<VaultThumbnailGenerationResponse> {
    return invokeOrFallback('vault_generate_thumbnails', undefined, () => apiClient.generateVaultThumbnails());
  },

  getVaultAssetSource(assetId: string): Promise<VaultAssetSourceResponse> {
    return invokeOrFallback('vault_get_asset_source', { assetId }, () => apiClient.getVaultAssetSource(assetId));
  },

  listVaultVersions(assetId: string): Promise<VaultVersionsResponse> {
    return invokeOrFallback('vault_list_versions', { assetId }, () => apiClient.listVaultVersions(assetId));
  },

  createVaultVersionSnapshot(assetId: string, reason: string): Promise<VaultVersionSnapshot> {
    return invokeOrFallback('vault_create_version_snapshot', { assetId, reason }, () => apiClient.createVaultVersionSnapshot(assetId, reason));
  },

  diffVaultVersions(assetId: string, fromSnapshotId: string, toSnapshotId: string): Promise<VaultVersionDiff> {
    return invokeOrFallback('vault_diff_versions', { assetId, fromSnapshotId, toSnapshotId }, () =>
      apiClient.diffVaultVersions(assetId, fromSnapshotId, toSnapshotId),
    );
  },

  rollbackVaultVersion(assetId: string, snapshotId: string): Promise<VaultVersionRollbackResponse> {
    return invokeOrFallback('vault_rollback_version', { assetId, snapshotId }, () => apiClient.rollbackVaultVersion(assetId, snapshotId));
  },

  checkVaultService(assetId: string): Promise<VaultServiceRuntimeState> {
    return invokeOrFallback('service_check_health', { assetId }, () => apiClient.checkVaultService(assetId));
  },

  startVaultService(assetId: string): Promise<VaultServiceRuntimeState> {
    return invokeOrFallback('service_start', { assetId }, () => apiClient.startVaultService(assetId));
  },

  stopVaultService(assetId: string): Promise<VaultServiceRuntimeState> {
    return invokeOrFallback('service_stop', { assetId }, () => apiClient.stopVaultService(assetId));
  },

  scanVaultAssetIntegrity(assetId: string): Promise<VaultAssetIntegrityReport> {
    return invokeOrFallback('asset_scan_integrity', { assetId }, () => apiClient.scanVaultAssetIntegrity(assetId));
  },

  exportVaultPackage(assetId: string): Promise<VaultStaticPackageExportResponse> {
    return invokeOrFallback('export_static_package', { assetId }, () => apiClient.exportVaultPackage(assetId));
  },

  exportVaultMarkdown(assetId: string): Promise<VaultMarkdownExportResponse> {
    return invokeOrFallback('export_markdown', { assetId }, () => apiClient.exportVaultMarkdown(assetId));
  },

  publishVaultStatic(assetId: string): Promise<VaultStaticPublishResponse> {
    return invokeOrFallback('publish_static', { assetId }, () => apiClient.publishVaultStatic(assetId));
  },

  reviewVaultAssetWrite(assetId: string, editedHtml: string): Promise<VaultWriteReview> {
    return invokeOrFallback('source_guard_review_write', { assetId, editedHtml }, () => apiClient.reviewVaultAssetWrite(assetId, editedHtml));
  },

  applyVaultWriteDecision(assetId: string, editedHtml: string, decision: VaultWriteDecision): Promise<VaultWriteDecisionResult> {
    return invokeOrFallback('source_guard_apply_write_decision', { assetId, editedHtml, decision }, () =>
      apiClient.applyVaultWriteDecision(assetId, editedHtml, decision),
    );
  },

  listAgentInbox(): Promise<AgentInboxResponse> {
    return invokeOrFallback('inbox_list_requests', undefined, () => apiClient.listAgentInbox());
  },

  confirmAgentInboxRequest(requestId: string): Promise<AgentInboxResponse> {
    return invokeOrFallback('inbox_confirm_request', { requestId }, () => apiClient.confirmAgentInboxRequest(requestId));
  },

  dismissAgentInboxRequest(requestId: string): Promise<AgentInboxResponse> {
    return invokeOrFallback('inbox_dismiss_request', { requestId }, () => apiClient.dismissAgentInboxRequest(requestId));
  },

  listNotes(): Promise<NoteMeta[]> {
    return invokeOrFallback('note_list', undefined, () => apiClient.listNotes());
  },

  createNote(input: { title: string; content?: string; tags?: string[] }): Promise<NoteMeta> {
    return invokeOrFallback('note_create', { input }, () => apiClient.createNote(input));
  },

  getNote(id: string): Promise<NoteRecord> {
    return invokeOrFallback('note_get', { id }, () => apiClient.getNote(id));
  },

  saveNoteContent(id: string, content: string): Promise<NoteMeta> {
    return invokeOrFallback('note_save_content', { id, content }, () => apiClient.saveNoteContent(id, content));
  },

  duplicateNote(id: string): Promise<NoteMeta> {
    return invokeOrFallback('note_duplicate', { id }, () => apiClient.duplicateNote(id));
  },

  deleteNote(id: string): Promise<void> {
    return invokeOrFallback('note_delete', { id }, () => apiClient.deleteNote(id));
  },

  aiStatus(): Promise<SafeAiStatus> {
    return invokeOrFallback('ai_status', undefined, () => apiClient.aiStatus());
  },

  runAiAction(input: AiActionRequest): Promise<AiActionResponse> {
    return invokeOrFallback('ai_run_action', { input }, () => apiClient.runAiAction(input));
  },

  organizeDiary(input: DiaryOrganizationRequest): Promise<DiaryOrganizationResponse> {
    return invokeOrFallback('diary_organize', { input }, () => apiClient.organizeDiary(input));
  },
};
