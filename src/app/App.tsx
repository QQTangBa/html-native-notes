import { useEffect, useMemo, useRef, useState } from 'react';
import { AiPanel } from '../features/ai/AiPanel';
import { HtmlEditor } from '../features/editor/HtmlEditor';
import { NoteLibrary } from '../features/notes/NoteLibrary';
import { PreviewPane } from '../features/preview/PreviewPane';
import { SettingsPanel } from '../features/settings/SettingsPanel';
import { VaultHome } from '../features/vault/VaultHome';
import { apiClient } from '../shared/api/client';
import type {
  AiAction,
  NoteMeta,
  NoteRecord,
  SafeAiStatus,
  VaultAssetSourceResponse,
  VaultLibraryResponse,
  VaultVersionDiff,
  VaultVersionSnapshot,
  VaultWriteDecision,
  VaultWriteReview,
} from '../shared/types';

const starterHtml = '<!doctype html><html><body><article><h1>新 HTML 笔记</h1><p>开始写你的内容。</p></article></body></html>';

export function App() {
  const [notes, setNotes] = useState<NoteMeta[]>([]);
  const [activeNote, setActiveNote] = useState<NoteRecord | undefined>();
  const [newTitle, setNewTitle] = useState('新 HTML 笔记');
  const [source, setSource] = useState(starterHtml);
  const [aiStatus, setAiStatus] = useState<SafeAiStatus>();
  const [vaultLibrary, setVaultLibrary] = useState<VaultLibraryResponse>();
  const [vaultPreview, setVaultPreview] = useState<VaultAssetSourceResponse>();
  const [vaultPreviewBusy, setVaultPreviewBusy] = useState(false);
  const [vaultWriteReview, setVaultWriteReview] = useState<VaultWriteReview>();
  const [vaultWriteBusy, setVaultWriteBusy] = useState(false);
  const [vaultWriteMessage, setVaultWriteMessage] = useState('');
  const [vaultWriteDecisionKey, setVaultWriteDecisionKey] = useState(0);
  const [vaultVersions, setVaultVersions] = useState<VaultVersionSnapshot[]>();
  const [vaultVersionDiff, setVaultVersionDiff] = useState<VaultVersionDiff>();
  const [vaultVersionBusy, setVaultVersionBusy] = useState(false);
  const [vaultVersionMessage, setVaultVersionMessage] = useState('');
  const [thumbnailBusy, setThumbnailBusy] = useState(false);
  const [thumbnailMessage, setThumbnailMessage] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const vaultReviewRequestIdRef = useRef(0);
  const vaultVersionRequestIdRef = useRef(0);
  const activeVaultPreviewIdRef = useRef<string | undefined>(undefined);
  const requestedVaultPreviewIdRef = useRef<string | undefined>(undefined);

  const activeNoteId = activeNote?.id;
  const statusLine = useMemo(() => {
    if (error) {
      return error;
    }

    if (activeNote) {
      return `Editing ${activeNote.title}`;
    }

    return 'Ready';
  }, [activeNote, error]);

  useEffect(() => {
    void refresh();
    void refreshVaultLibrary();
    void apiClient.aiStatus().then(setAiStatus).catch(() => setAiStatus({ configured: false, baseUrlSet: false }));
  }, []);

  useEffect(() => {
    activeVaultPreviewIdRef.current = vaultPreview?.assetId;
  }, [vaultPreview?.assetId]);

  async function refresh(): Promise<void> {
    setNotes(await apiClient.listNotes());
  }

  async function refreshVaultLibrary(): Promise<void> {
    await apiClient.listVaultLibrary().then(setVaultLibrary).catch(() => setVaultLibrary(undefined));
  }

  async function runTask(task: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }

  async function openNote(id: string): Promise<void> {
    await runTask(async () => {
      const note = await apiClient.getNote(id);
      setActiveNote(note);
      setSource(note.content);
    });
  }

  async function createNote(): Promise<void> {
    await runTask(async () => {
      const title = newTitle.trim() || '新 HTML 笔记';
      const content = starterHtml.replace('新 HTML 笔记', title);
      const note = await apiClient.createNote({
        title,
        content,
      });
      setNotes((current) => [note, ...current.filter((item) => item.id !== note.id)]);
      setActiveNote({ ...note, content });
      setSource(content);
    });
  }

  async function saveNote(): Promise<void> {
    if (!activeNoteId) {
      return;
    }

    await runTask(async () => {
      const updated = await apiClient.saveNoteContent(activeNoteId, source);
      setActiveNote({ ...activeNote!, ...updated, content: source });
      await refresh();
    });
  }

  async function duplicateNote(): Promise<void> {
    if (!activeNoteId) {
      return;
    }

    await runTask(async () => {
      const copy = await apiClient.duplicateNote(activeNoteId);
      await refresh();
      await openNote(copy.id);
    });
  }

  async function deleteNote(): Promise<void> {
    if (!activeNoteId) {
      return;
    }

    await runTask(async () => {
      await apiClient.deleteNote(activeNoteId);
      setActiveNote(undefined);
      setSource(starterHtml);
      await refresh();
    });
  }

  async function runAi(action: AiAction): Promise<void> {
    await runTask(async () => {
      const response = await apiClient.runAiAction({ action, content: source });
      setAiResult(response.result);
    });
  }

  async function generateVaultThumbnails(): Promise<void> {
    setThumbnailBusy(true);
    setThumbnailMessage('Rendering thumbnails');
    setError('');

    try {
      const result = await apiClient.generateVaultThumbnails();
      await refreshVaultLibrary();
      setThumbnailMessage(
        result.generatedCount > 0
          ? `${result.generatedCount} thumbnail${result.generatedCount === 1 ? '' : 's'} ready`
          : 'Thumbnails ready',
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '缩略图生成失败');
      setThumbnailMessage('Thumbnail generation failed');
    } finally {
      setThumbnailBusy(false);
    }
  }

  async function openVaultItem(itemId: string): Promise<void> {
    const requestId = vaultReviewRequestIdRef.current + 1;
    const versionRequestId = vaultVersionRequestIdRef.current + 1;
    vaultReviewRequestIdRef.current = requestId;
    vaultVersionRequestIdRef.current = versionRequestId;
    requestedVaultPreviewIdRef.current = itemId;
    setVaultPreviewBusy(true);
    setVaultWriteReview(undefined);
    setVaultWriteMessage('');
    setVaultVersions(undefined);
    setVaultVersionDiff(undefined);
    setVaultVersionBusy(true);
    setVaultVersionMessage('Loading versions');
    setError('');

    try {
      const preview = await apiClient.getVaultAssetSource(itemId);
      if (vaultReviewRequestIdRef.current !== requestId) {
        return;
      }
      setVaultPreview(preview);

      try {
        const versions = await apiClient.listVaultVersions(itemId);
        if (vaultReviewRequestIdRef.current !== requestId || vaultVersionRequestIdRef.current !== versionRequestId) {
          return;
        }
        setVaultVersions(versions.snapshots);
        setVaultVersionMessage(versions.snapshots.length > 0 ? 'Version history ready' : 'No snapshots yet');
      } catch {
        if (vaultReviewRequestIdRef.current !== requestId || vaultVersionRequestIdRef.current !== versionRequestId) {
          return;
        }
        setVaultVersions([]);
        setVaultVersionMessage('Version history unavailable');
      }
    } catch (caught) {
      if (vaultReviewRequestIdRef.current === requestId) {
        setError(caught instanceof Error ? caught.message : '预览打开失败');
      }
    } finally {
      if (vaultReviewRequestIdRef.current === requestId) {
        setVaultPreviewBusy(false);
        setVaultVersionBusy(false);
      }
    }
  }

  async function compareLatestVaultVersions(): Promise<void> {
    if (!vaultPreview || !vaultVersions || vaultVersions.length < 2) {
      return;
    }

    const from = vaultVersions[vaultVersions.length - 2];
    const to = vaultVersions[vaultVersions.length - 1];
    const assetId = vaultPreview.assetId;
    const versionRequestId = vaultVersionRequestIdRef.current + 1;
    vaultVersionRequestIdRef.current = versionRequestId;
    setVaultVersionBusy(true);
    setVaultVersionMessage('Comparing versions');
    setError('');

    try {
      const diff = await apiClient.diffVaultVersions(assetId, from.snapshotId, to.snapshotId);
      if (vaultVersionRequestIdRef.current !== versionRequestId || requestedVaultPreviewIdRef.current !== assetId) {
        return;
      }
      setVaultVersionDiff(diff);
      setVaultVersionMessage('Diff ready');
    } catch (caught) {
      if (vaultVersionRequestIdRef.current !== versionRequestId || requestedVaultPreviewIdRef.current !== assetId) {
        return;
      }
      setError(caught instanceof Error ? caught.message : '版本对比失败');
      setVaultVersionMessage('Diff failed');
    } finally {
      if (vaultVersionRequestIdRef.current === versionRequestId && requestedVaultPreviewIdRef.current === assetId) {
        setVaultVersionBusy(false);
      }
    }
  }

  async function rollbackVaultVersion(snapshotId: string): Promise<void> {
    if (!vaultPreview) {
      return;
    }

    const assetId = vaultPreview.assetId;
    const versionRequestId = vaultVersionRequestIdRef.current + 1;
    vaultVersionRequestIdRef.current = versionRequestId;
    setVaultVersionBusy(true);
    setVaultVersionMessage('Rolling back');
    setError('');

    try {
      await apiClient.rollbackVaultVersion(assetId, snapshotId);
      const [preview, versions] = await Promise.all([apiClient.getVaultAssetSource(assetId), apiClient.listVaultVersions(assetId)]);
      if (vaultVersionRequestIdRef.current !== versionRequestId || requestedVaultPreviewIdRef.current !== assetId) {
        return;
      }
      setVaultPreview(preview);
      setVaultVersions(versions.snapshots);
      setVaultVersionDiff(undefined);
      setVaultVersionMessage('Rollback complete');
    } catch (caught) {
      if (vaultVersionRequestIdRef.current !== versionRequestId || requestedVaultPreviewIdRef.current !== assetId) {
        return;
      }
      setError(caught instanceof Error ? caught.message : '版本回滚失败');
      setVaultVersionMessage('Rollback failed');
    } finally {
      if (vaultVersionRequestIdRef.current === versionRequestId && requestedVaultPreviewIdRef.current === assetId) {
        setVaultVersionBusy(false);
      }
    }
  }

  async function reviewVaultEdit(editedHtml: string): Promise<void> {
    const preview = vaultPreview;
    if (!preview) {
      return;
    }

    const requestId = vaultReviewRequestIdRef.current + 1;
    vaultReviewRequestIdRef.current = requestId;
    setVaultWriteBusy(true);
    setVaultWriteMessage('Reviewing changes');
    setError('');

    try {
      const review = await apiClient.reviewVaultAssetWrite(preview.assetId, editedHtml);
      if (vaultReviewRequestIdRef.current !== requestId || activeVaultPreviewIdRef.current !== preview.assetId) {
        return;
      }
      setVaultWriteReview(review);
      setVaultWriteMessage(review.status === 'changed' ? 'Review ready' : 'No changes detected');
    } catch (caught) {
      if (vaultReviewRequestIdRef.current !== requestId || activeVaultPreviewIdRef.current !== preview.assetId) {
        return;
      }
      setError(caught instanceof Error ? caught.message : '写入审查失败');
      setVaultWriteMessage('Review failed');
    } finally {
      if (vaultReviewRequestIdRef.current === requestId) {
        setVaultWriteBusy(false);
      }
    }
  }

  function saveAsPathFor(sourcePath: string): string {
    return sourcePath.match(/\.html?$/i) ? sourcePath.replace(/\.html?$/i, '.copy.html') : `${sourcePath}.copy.html`;
  }

  async function applyVaultDecision(decision: VaultWriteDecision): Promise<void> {
    if (!vaultWriteReview || !vaultPreview) {
      return;
    }

    const assetId = vaultPreview.assetId;
    const editedHtml = vaultWriteReview.editedHtml;
    setVaultWriteBusy(true);
    setError('');

    try {
      const result = await apiClient.applyVaultWriteDecision(assetId, editedHtml, decision);
      setVaultWriteMessage(
        result.action === 'cancel'
          ? 'Write cancelled'
          : result.action === 'save-as'
            ? 'Copy saved'
            : 'Source updated',
      );
      if (result.action === 'write-back') {
        setVaultPreview((current) => (current?.assetId === assetId ? { ...current, html: editedHtml } : current));
      }
      setVaultWriteReview(undefined);
      setVaultWriteDecisionKey((current) => current + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '写入决策失败');
      setVaultWriteMessage('Decision failed');
    } finally {
      setVaultWriteBusy(false);
    }
  }

  function insertAiResult(): void {
    if (!aiResult) {
      return;
    }

    setSource((current) => `${current}\n${aiResult}`);
    setAiResult('');
  }

  if (vaultLibrary?.items.length) {
    return (
      <main className="desktop-vault-shell" data-testid="workspace-shell">
        <VaultHome
          items={vaultLibrary.items}
          activeItemId={vaultPreview?.assetId}
          previewHtml={vaultPreview?.html}
          previewTitle={vaultPreviewBusy ? 'Loading preview' : vaultPreview?.title}
          thumbnailBusy={thumbnailBusy}
          thumbnailMessage={thumbnailMessage || undefined}
          writeReview={vaultWriteReview}
          writeBusy={vaultWriteBusy}
          writeMessage={vaultWriteMessage || undefined}
          writeDecisionKey={vaultWriteDecisionKey}
          versionSnapshots={vaultVersions}
          versionDiff={vaultVersionDiff}
          versionBusy={vaultVersionBusy}
          versionMessage={vaultVersionMessage || undefined}
          onOpenItem={(itemId) => void openVaultItem(itemId)}
          onGenerateThumbnails={() => void generateVaultThumbnails()}
          onCompareLatestVersions={() => void compareLatestVaultVersions()}
          onRollbackSnapshot={(snapshotId) => void rollbackVaultVersion(snapshotId)}
          onReviewEdit={(editedHtml) => void reviewVaultEdit(editedHtml)}
          onCancelWrite={() => void applyVaultDecision({ action: 'cancel' })}
          onSaveAs={() => {
            if (vaultWriteReview) {
              void applyVaultDecision({ action: 'save-as', saveAsPath: saveAsPathFor(vaultWriteReview.sourcePath) });
            }
          }}
          onWriteBack={() => void applyVaultDecision({ action: 'write-back' })}
        />
        <div className={error ? 'status-bar error' : 'status-bar'}>{statusLine}</div>
      </main>
    );
  }

  return (
    <main className="workspace-shell" data-testid="workspace-shell">
      <NoteLibrary
        notes={notes}
        activeNoteId={activeNoteId}
        newTitle={newTitle}
        busy={busy}
        onTitleChange={setNewTitle}
        onCreate={() => void createNote()}
        onOpen={(id) => void openNote(id)}
        onSave={() => void saveNote()}
        onDuplicate={() => void duplicateNote()}
        onDelete={() => void deleteNote()}
      />

      <HtmlEditor value={source} onChange={setSource} />

      <aside className="panel side-panel">
        <SettingsPanel status={aiStatus} />
        <PreviewPane html={source} />
        <AiPanel status={aiStatus} busy={busy} result={aiResult} onRun={(action) => void runAi(action)} onInsert={insertAiResult} />
      </aside>

      <div className={error ? 'status-bar error' : 'status-bar'}>{statusLine}</div>
    </main>
  );
}
