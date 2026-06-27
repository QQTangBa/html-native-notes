import { useEffect, useMemo, useRef, useState } from 'react';
import { Languages, Moon, Sun } from 'lucide-react';
import { AiPanel } from '../features/ai/AiPanel';
import { DiaryPanel } from '../features/diary/DiaryPanel';
import { HtmlEditor } from '../features/editor/HtmlEditor';
import { NoteLibrary } from '../features/notes/NoteLibrary';
import { PreviewPane } from '../features/preview/PreviewPane';
import { SettingsPanel } from '../features/settings/SettingsPanel';
import { VaultHome } from '../features/vault/VaultHome';
import { desktopBridge } from '../shared/desktopBridge';
import { appCopy, detectInitialLocale, detectInitialTheme, persistPreference, type Locale, type ThemeMode } from '../shared/i18n';
import type {
  AgentInboxResponse,
  AiAction,
  DiaryOrganizationResponse,
  DiaryOrganizationStyle,
  NoteMeta,
  NoteRecord,
  SafeAiStatus,
  VaultAssetIntegrityReport,
  VaultExportResponse,
  VaultAssetSourceResponse,
  VaultLibraryResponse,
  VaultServiceRuntimeState,
  VaultVersionDiff,
  VaultVersionSnapshot,
  VaultWriteDecision,
  VaultWriteReview,
} from '../shared/types';

const starterHtml = '<!doctype html><html><body><article><h1>新 HTML 笔记</h1><p>开始写你的内容。</p></article></body></html>';
const emptyAgentInbox: AgentInboxResponse = {
  requests: [],
  invalidLines: [],
  skippedDuplicates: [],
};

export function App() {
  const [locale, setLocale] = useState<Locale>(() => detectInitialLocale());
  const [theme, setTheme] = useState<ThemeMode>(() => detectInitialTheme());
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
  const [vaultServiceStates, setVaultServiceStates] = useState<Record<string, VaultServiceRuntimeState>>({});
  const [vaultServiceBusyIds, setVaultServiceBusyIds] = useState<string[]>([]);
  const [vaultAssetReports, setVaultAssetReports] = useState<Record<string, VaultAssetIntegrityReport>>({});
  const [vaultAssetBusyIds, setVaultAssetBusyIds] = useState<string[]>([]);
  const [vaultExportResults, setVaultExportResults] = useState<Record<string, VaultExportResponse>>({});
  const [vaultExportBusyIds, setVaultExportBusyIds] = useState<string[]>([]);
  const [vaultInbox, setVaultInbox] = useState<AgentInboxResponse>(emptyAgentInbox);
  const [vaultInboxBusyIds, setVaultInboxBusyIds] = useState<string[]>([]);
  const [thumbnailBusy, setThumbnailBusy] = useState(false);
  const [thumbnailMessage, setThumbnailMessage] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [diaryResult, setDiaryResult] = useState<DiaryOrganizationResponse>();
  const [diaryBusy, setDiaryBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const vaultReviewRequestIdRef = useRef(0);
  const vaultVersionRequestIdRef = useRef(0);
  const activeVaultPreviewIdRef = useRef<string | undefined>(undefined);
  const requestedVaultPreviewIdRef = useRef<string | undefined>(undefined);

  const activeNoteId = activeNote?.id;
  const copy = appCopy[locale];
  const statusLine = useMemo(() => {
    if (error) {
      return error;
    }

    if (activeNote) {
      return copy.status.editing(activeNote.title);
    }

    return copy.status.ready;
  }, [activeNote, copy, error]);

  useEffect(() => {
    persistPreference('locale', locale);
  }, [locale]);

  useEffect(() => {
    persistPreference('theme', theme);
  }, [theme]);

  useEffect(() => {
    void refresh();
    void refreshVaultLibrary();
    void refreshAgentInbox();
    void desktopBridge.aiStatus().then(setAiStatus).catch(() => setAiStatus({ configured: false, baseUrlSet: false }));
  }, []);

  useEffect(() => {
    activeVaultPreviewIdRef.current = vaultPreview?.assetId;
  }, [vaultPreview?.assetId]);

  useEffect(() => {
    const firstHtmlAsset = vaultLibrary?.items.find((item) => item.kind === 'html-note');

    if (!firstHtmlAsset || vaultPreview || vaultPreviewBusy || requestedVaultPreviewIdRef.current) {
      return;
    }

    void openVaultItem(firstHtmlAsset.id);
  }, [vaultLibrary, vaultPreview, vaultPreviewBusy]);

  async function refresh(): Promise<void> {
    setNotes(await desktopBridge.listNotes());
  }

  async function refreshVaultLibrary(): Promise<void> {
    await desktopBridge.listVaultLibrary().then(setVaultLibrary).catch(() => setVaultLibrary(undefined));
  }

  async function refreshAgentInbox(): Promise<void> {
    await desktopBridge.listAgentInbox().then(setVaultInbox).catch(() => setVaultInbox(emptyAgentInbox));
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
      const note = await desktopBridge.getNote(id);
      setActiveNote(note);
      setSource(note.content);
    });
  }

  async function createNote(): Promise<void> {
    await runTask(async () => {
      const title = newTitle.trim() || '新 HTML 笔记';
      const content = starterHtml.replace('新 HTML 笔记', title);
      const note = await desktopBridge.createNote({
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
      const updated = await desktopBridge.saveNoteContent(activeNoteId, source);
      setActiveNote({ ...activeNote!, ...updated, content: source });
      await refresh();
    });
  }

  async function duplicateNote(): Promise<void> {
    if (!activeNoteId) {
      return;
    }

    await runTask(async () => {
      const copy = await desktopBridge.duplicateNote(activeNoteId);
      await refresh();
      await openNote(copy.id);
    });
  }

  async function deleteNote(): Promise<void> {
    if (!activeNoteId) {
      return;
    }

    await runTask(async () => {
      await desktopBridge.deleteNote(activeNoteId);
      setActiveNote(undefined);
      setSource(starterHtml);
      await refresh();
    });
  }

  async function runAi(action: AiAction): Promise<void> {
    await runTask(async () => {
      const response = await desktopBridge.runAiAction({ action, content: source });
      setAiResult(response.result);
    });
  }

  async function organizeDiary(): Promise<void> {
    setDiaryBusy(true);
    setError('');

    try {
      setDiaryResult(await desktopBridge.organizeDiary({ originalText: source }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '日记整理失败');
    } finally {
      setDiaryBusy(false);
    }
  }

  async function generateVaultThumbnails(): Promise<void> {
    setThumbnailBusy(true);
    setThumbnailMessage('Rendering thumbnails');
    setError('');

    try {
      const result = await desktopBridge.generateVaultThumbnails();
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
      const preview = await desktopBridge.getVaultAssetSource(itemId);
      if (vaultReviewRequestIdRef.current !== requestId) {
        return;
      }
      setVaultPreview(preview);

      try {
        const versions = await desktopBridge.listVaultVersions(itemId);
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
      const diff = await desktopBridge.diffVaultVersions(assetId, from.snapshotId, to.snapshotId);
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
      await desktopBridge.rollbackVaultVersion(assetId, snapshotId);
      const [preview, versions] = await Promise.all([desktopBridge.getVaultAssetSource(assetId), desktopBridge.listVaultVersions(assetId)]);
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

  async function runVaultServiceAction(
    assetId: string,
    action: (id: string) => Promise<VaultServiceRuntimeState>,
    failureMessage: string,
  ): Promise<void> {
    setVaultServiceBusyIds((current) => [...new Set([...current, assetId])]);
    setError('');

    try {
      const result = await action(assetId);
      setVaultServiceStates((current) => ({ ...current, [assetId]: result }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : failureMessage);
    } finally {
      setVaultServiceBusyIds((current) => current.filter((id) => id !== assetId));
    }
  }

  async function scanVaultAssetIntegrity(assetId: string): Promise<void> {
    setVaultAssetBusyIds((current) => [...new Set([...current, assetId])]);
    setError('');

    try {
      const report = await desktopBridge.scanVaultAssetIntegrity(assetId);
      setVaultAssetReports((current) => ({ ...current, [assetId]: report }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '资源完整性扫描失败');
    } finally {
      setVaultAssetBusyIds((current) => current.filter((id) => id !== assetId));
    }
  }

  async function runVaultExportAction(assetId: string, action: (id: string) => Promise<VaultExportResponse>, failureMessage: string): Promise<void> {
    setVaultExportBusyIds((current) => [...new Set([...current, assetId])]);
    setError('');

    try {
      const result = await action(assetId);
      setVaultExportResults((current) => ({ ...current, [assetId]: result }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : failureMessage);
    } finally {
      setVaultExportBusyIds((current) => current.filter((id) => id !== assetId));
    }
  }

  async function runAgentInboxAction(
    requestId: string,
    action: (id: string) => Promise<AgentInboxResponse>,
    options: { refreshLibrary?: boolean; failureMessage: string },
  ): Promise<void> {
    setVaultInboxBusyIds((current) => [...new Set([...current, requestId])]);
    setError('');

    try {
      setVaultInbox(await action(requestId));
      if (options.refreshLibrary) {
        await refreshVaultLibrary();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : options.failureMessage);
    } finally {
      setVaultInboxBusyIds((current) => current.filter((id) => id !== requestId));
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
      const review = await desktopBridge.reviewVaultAssetWrite(preview.assetId, editedHtml);
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
      const result = await desktopBridge.applyVaultWriteDecision(assetId, editedHtml, decision);
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

  function insertDiaryStyle(style: DiaryOrganizationStyle): void {
    setSource((current) => `${current}\n${style.html}`);
  }

  const shouldShowVaultHome =
    vaultLibrary &&
    (vaultLibrary.items.length > 0 ||
      vaultInbox.requests.length > 0 ||
      vaultInbox.invalidLines.length > 0 ||
      vaultInbox.skippedDuplicates.length > 0);

  const preferenceControls = (
    <div className="app-preferences" aria-label="Application preferences">
      <div className="segmented-control" aria-label={copy.preferences.language}>
        <Languages size={15} aria-hidden="true" />
        <button type="button" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>
          {copy.preferences.english}
        </button>
        <button type="button" aria-pressed={locale === 'zh'} onClick={() => setLocale('zh')}>
          {copy.preferences.chinese}
        </button>
      </div>
      <div className="segmented-control" aria-label={copy.preferences.theme}>
        <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')} aria-label={copy.preferences.darkTheme}>
          <Moon size={15} aria-hidden="true" />
        </button>
        <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')} aria-label={copy.preferences.lightTheme}>
          <Sun size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  if (shouldShowVaultHome) {
    return (
      <main className="desktop-vault-shell" data-testid="workspace-shell" data-locale={locale} data-theme={theme}>
        {preferenceControls}
        <VaultHome
          items={vaultLibrary.items}
          copy={copy.vault}
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
          serviceStates={vaultServiceStates}
          serviceBusyIds={vaultServiceBusyIds}
          assetReports={vaultAssetReports}
          assetBusyIds={vaultAssetBusyIds}
          exportResults={vaultExportResults}
          exportBusyIds={vaultExportBusyIds}
          inboxRequests={vaultInbox.requests}
          inboxInvalidLines={vaultInbox.invalidLines}
          inboxSkippedDuplicates={vaultInbox.skippedDuplicates}
          inboxBusyRequestIds={vaultInboxBusyIds}
          onOpenItem={(itemId) => void openVaultItem(itemId)}
          onGenerateThumbnails={() => void generateVaultThumbnails()}
          onServiceHealth={(itemId) => void runVaultServiceAction(itemId, desktopBridge.checkVaultService, '服务状态检查失败')}
          onServiceStart={(itemId) => void runVaultServiceAction(itemId, desktopBridge.startVaultService, '服务启动失败')}
          onServiceStop={(itemId) => void runVaultServiceAction(itemId, desktopBridge.stopVaultService, '服务停止失败')}
          onScanAssetIntegrity={(itemId) => void scanVaultAssetIntegrity(itemId)}
          onExportPackage={(itemId) => void runVaultExportAction(itemId, desktopBridge.exportVaultPackage, '导出静态包失败')}
          onExportMarkdown={(itemId) => void runVaultExportAction(itemId, desktopBridge.exportVaultMarkdown, '导出 Markdown 失败')}
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
          onConfirmInboxRequest={(requestId) =>
            void runAgentInboxAction(requestId, desktopBridge.confirmAgentInboxRequest, {
              refreshLibrary: true,
              failureMessage: 'Inbox 确认失败',
            })
          }
          onDismissInboxRequest={(requestId) =>
            void runAgentInboxAction(requestId, desktopBridge.dismissAgentInboxRequest, {
              failureMessage: 'Inbox 忽略失败',
            })
          }
        />
        <div className={error ? 'status-bar error' : 'status-bar'}>{statusLine}</div>
      </main>
    );
  }

  return (
    <main className="workspace-shell" data-testid="workspace-shell" data-locale={locale} data-theme={theme}>
      {preferenceControls}
      <NoteLibrary
        notes={notes}
        activeNoteId={activeNoteId}
        newTitle={newTitle}
        busy={busy}
        copy={copy.notes}
        onTitleChange={setNewTitle}
        onCreate={() => void createNote()}
        onOpen={(id) => void openNote(id)}
        onSave={() => void saveNote()}
        onDuplicate={() => void duplicateNote()}
        onDelete={() => void deleteNote()}
      />

      <HtmlEditor value={source} onChange={setSource} />

      <aside className="panel side-panel">
        <SettingsPanel status={aiStatus} copy={copy.settings} />
        <PreviewPane html={source} />
        <DiaryPanel
          status={aiStatus}
          source={source}
          busy={diaryBusy}
          result={diaryResult}
          onOrganize={() => void organizeDiary()}
          onInsertStyle={insertDiaryStyle}
        />
        <AiPanel status={aiStatus} busy={busy} result={aiResult} onRun={(action) => void runAi(action)} onInsert={insertAiResult} />
      </aside>

      <div className={error ? 'status-bar error' : 'status-bar'}>{statusLine}</div>
    </main>
  );
}
