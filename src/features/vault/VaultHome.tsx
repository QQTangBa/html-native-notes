import {
  Eye,
  FileText,
  Folder,
  GitCompare,
  Grid2X2,
  History,
  List,
  Pencil,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Activity,
  Download,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useState, type CSSProperties } from 'react';
import { applyElementTextEdit, listEditableHtmlElements } from '../../../bridge/html/elementEditing';
import type { InvalidInboxLine } from '../../../bridge/inbox/jsonlInbox';
import type { NormalizedBridgeRequest } from '../../../bridge/shared/protocol';
import { InboxPanel } from '../bridge/InboxPanel';
import { appCopy, type AppCopy } from '../../shared/i18n';
import type {
  VaultAssetIntegrityReport,
  VaultExportResponse,
  VaultServiceRuntimeState,
  VaultVersionDiff,
  VaultVersionSnapshot,
  VaultWriteReview,
} from '../../shared/types';

export interface VaultHomeItem {
  id: string;
  kind: 'html-note' | 'markdown-note' | 'service' | 'project';
  title: string;
  sourceAgent?: string;
  sourcePath?: string;
  relativeSourcePath?: string;
  folderPath: string;
  tags: string[];
  summary: string;
  updatedAt: string;
  thumbnail: {
    status: 'ready' | 'pending';
    path: string;
  };
}

export interface VaultHomeProps {
  items: VaultHomeItem[];
  activeItemId?: string;
  previewHtml?: string;
  previewTitle?: string;
  writeReview?: VaultWriteReview;
  writeBusy?: boolean;
  writeMessage?: string;
  writeDecisionKey?: number;
  versionSnapshots?: VaultVersionSnapshot[];
  versionDiff?: VaultVersionDiff;
  versionBusy?: boolean;
  versionMessage?: string;
  serviceStates?: Record<string, VaultServiceRuntimeState>;
  serviceBusyIds?: string[];
  assetReports?: Record<string, VaultAssetIntegrityReport>;
  assetBusyIds?: string[];
  exportResults?: Record<string, VaultExportResponse>;
  exportBusyIds?: string[];
  markdownConvertBusyIds?: string[];
  thumbnailBusy?: boolean;
  thumbnailMessage?: string;
  inboxRequests?: NormalizedBridgeRequest[];
  inboxInvalidLines?: InvalidInboxLine[];
  inboxSkippedDuplicates?: string[];
  inboxBusyRequestIds?: string[];
  copy?: AppCopy['vault'];
  onOpenItem?: (itemId: string) => void;
  onGenerateThumbnails?: () => void;
  onServiceHealth?: (itemId: string) => void;
  onServiceStart?: (itemId: string) => void;
  onServiceStop?: (itemId: string) => void;
  onScanAssetIntegrity?: (itemId: string) => void;
  onExportPackage?: (itemId: string) => void;
  onExportMarkdown?: (itemId: string) => void;
  onConvertMarkdownToHtml?: (itemId: string) => void;
  onRunScopedAiEdit?: (input: { selector: string; instruction: string }) => void;
  onCompareLatestVersions?: () => void;
  onRollbackSnapshot?: (snapshotId: string) => void;
  onReviewEdit?: (editedHtml: string) => void;
  onCancelWrite?: () => void;
  onSaveAs?: () => void;
  onWriteBack?: () => void;
  onConfirmInboxRequest?: (requestId: string) => void;
  onDismissInboxRequest?: (requestId: string) => void;
}

type ViewMode = 'card' | 'list';

type VaultTreeRow =
  | {
      type: 'folder';
      id: string;
      label: string;
      path: string;
      depth: number;
      itemCount: number;
    }
  | {
      type: 'item';
      id: string;
      label: string;
      item: VaultHomeItem;
      depth: number;
    };

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function matchesQuery(item: VaultHomeItem, query: string): boolean {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
  const haystack = [item.title, item.summary, item.relativeSourcePath, item.sourceAgent, ...item.tags]
    .join(' ')
    .toLowerCase();

  return terms.every((term) => haystack.includes(term));
}

function formatTime(value: string): string {
  const unixMatch = value.match(/^unix:(\d+)$/);
  const date = unixMatch ? new Date(Number(unixMatch[1]) * 1000) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function pendingThumbnailLabel(count: number): string {
  return `${count} pending thumbnail${count === 1 ? '' : 's'}`;
}

function pathSegments(path: string | undefined): string[] {
  return (path ?? 'root')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function sourceFolderPath(item: VaultHomeItem): string {
  const relativePath = item.relativeSourcePath?.trim();

  if (relativePath) {
    const segments = pathSegments(relativePath);
    if (segments.length > 1) {
      return segments.slice(0, -1).join('/');
    }
  }

  return item.folderPath || 'root';
}

function displayFolderPath(item: VaultHomeItem): string {
  const segments = pathSegments(sourceFolderPath(item));

  if (segments.length === 0) {
    return 'root';
  }

  const knownVaultRoots = ['imports', 'services', 'agent-output', 'notes', 'projects'];
  const vaultRootIndex = segments.findIndex((segment) => knownVaultRoots.includes(segment));
  if (vaultRootIndex >= 0) {
    return segments.slice(vaultRootIndex).join('/');
  }

  const scratchRootIndex = segments.findIndex((segment) => segment === 'test-results');
  if (scratchRootIndex >= 0 && scratchRootIndex + 1 < segments.length) {
    return segments.slice(scratchRootIndex + 1).join('/');
  }

  if (segments[0] === 'Users' || segments[0] === 'Volumes') {
    return segments.slice(-2).join('/');
  }

  return segments.join('/');
}

function buildVaultTreeRows(items: VaultHomeItem[]): VaultTreeRow[] {
  const folderRows = new Map<string, Extract<VaultTreeRow, { type: 'folder' }>>();

  for (const item of items) {
    const segments = pathSegments(displayFolderPath(item));
    for (let index = 0; index < segments.length; index += 1) {
      const path = segments.slice(0, index + 1).join('/');
      const existing = folderRows.get(path);
      if (existing) {
        existing.itemCount += index === segments.length - 1 ? 1 : 0;
      } else {
        folderRows.set(path, {
          type: 'folder',
          id: `folder:${path}`,
          label: segments[index],
          path,
          depth: index,
          itemCount: index === segments.length - 1 ? 1 : 0,
        });
      }
    }
  }

  const rows: VaultTreeRow[] = Array.from(folderRows.values()).sort((a, b) => a.path.localeCompare(b.path));
  const itemRows: VaultTreeRow[] = items
    .map((item) => ({
      type: 'item' as const,
      id: `item:${item.id}`,
      label: item.title,
      item,
      depth: pathSegments(displayFolderPath(item)).length,
    }))
    .sort((a, b) => {
      const folderCompare = displayFolderPath(a.item).localeCompare(displayFolderPath(b.item));
      return folderCompare || a.label.localeCompare(b.label);
    });

  return [...rows, ...itemRows];
}

export function VaultHome({
  items,
  activeItemId,
  previewHtml,
  previewTitle,
  writeReview,
  writeBusy = false,
  writeMessage,
  writeDecisionKey = 0,
  versionSnapshots,
  versionDiff,
  versionBusy = false,
  versionMessage,
  serviceStates,
  serviceBusyIds = [],
  assetReports,
  assetBusyIds = [],
  exportResults,
  exportBusyIds = [],
  markdownConvertBusyIds = [],
  thumbnailBusy = false,
  thumbnailMessage,
  inboxRequests = [],
  inboxInvalidLines = [],
  inboxSkippedDuplicates = [],
  inboxBusyRequestIds = [],
  copy = appCopy.en.vault,
  onOpenItem,
  onGenerateThumbnails,
  onServiceHealth,
  onServiceStart,
  onServiceStop,
  onScanAssetIntegrity,
  onExportPackage,
  onExportMarkdown,
  onConvertMarkdownToHtml,
  onRunScopedAiEdit,
  onCompareLatestVersions,
  onRollbackSnapshot,
  onReviewEdit,
  onCancelWrite,
  onSaveAs,
  onWriteBack,
  onConfirmInboxRequest,
  onDismissInboxRequest,
}: VaultHomeProps) {
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const [sourceAgent, setSourceAgent] = useState('');
  const [folder, setFolder] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [isEditingPreview, setIsEditingPreview] = useState(false);
  const [draftHtml, setDraftHtml] = useState('');
  const [selectedElementSelector, setSelectedElementSelector] = useState('');
  const [elementDraft, setElementDraft] = useState('');
  const [elementAiInstruction, setElementAiInstruction] = useState('');

  useLayoutEffect(() => {
    setIsEditingPreview(false);
    setDraftHtml('');
  }, [activeItemId]);

  useEffect(() => {
    if (writeDecisionKey > 0) {
      setIsEditingPreview(false);
      setDraftHtml('');
    }
  }, [writeDecisionKey]);

  const tags = useMemo(() => uniqueSorted(items.flatMap((item) => item.tags)), [items]);
  const sourceAgents = useMemo(() => uniqueSorted(items.flatMap((item) => (item.sourceAgent ? [item.sourceAgent] : []))), [items]);
  const treeRows = useMemo(() => buildVaultTreeRows(items), [items]);
  const activeItem = useMemo(() => items.find((item) => item.id === activeItemId), [activeItemId, items]);
  const canEditRenderedElements = !activeItem || activeItem.kind === 'html-note';
  const editableElements = useMemo(() => {
    if (!previewHtml || !canEditRenderedElements) {
      return [];
    }

    try {
      return listEditableHtmlElements(previewHtml);
    } catch {
      return [];
    }
  }, [canEditRenderedElements, previewHtml]);
  const pendingThumbnailCount = useMemo(
    () => items.filter((item) => item.kind === 'html-note' && item.thumbnail.status === 'pending').length,
    [items],
  );
  const visibleItems = useMemo(
    () =>
      items
        .filter((item) => matchesQuery(item, query))
        .filter((item) => !tag || item.tags.includes(tag))
        .filter((item) => !sourceAgent || item.sourceAgent === sourceAgent)
        .filter((item) => !folder || displayFolderPath(item) === folder)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [folder, items, query, sourceAgent, tag],
  );

  function clearFilters(): void {
    setQuery('');
    setTag('');
    setSourceAgent('');
    setFolder('');
  }

  function startPreviewEdit(): void {
    setDraftHtml(previewHtml ?? '');
    setIsEditingPreview(true);
  }

  function selectEditableElement(selector: string): void {
    const nextElement = editableElements.find((element) => element.selector === selector);
    setSelectedElementSelector(selector);
    setElementDraft(nextElement?.text ?? '');
  }

  function reviewSelectedElementEdit(): void {
    if (!previewHtml || !selectedElementSelector || !onReviewEdit) {
      return;
    }

    onReviewEdit(applyElementTextEdit(previewHtml, selectedElementSelector, elementDraft));
  }

  function runScopedAiEdit(): void {
    const instruction = elementAiInstruction.trim();
    if (!selectedElementSelector || !instruction) {
      return;
    }

    onRunScopedAiEdit?.({
      selector: selectedElementSelector,
      instruction,
    });
  }

  const canGenerateThumbnails = Boolean(onGenerateThumbnails && pendingThumbnailCount > 0);
  const thumbnailButtonLabel = thumbnailBusy ? `${copy.rendering} thumbnails` : `${copy.generate} ${pendingThumbnailLabel(pendingThumbnailCount)}`;
  const thumbnailStatusText = thumbnailMessage ?? (pendingThumbnailCount > 0 ? pendingThumbnailLabel(pendingThumbnailCount) : 'Thumbnails ready');
  const diffLines = writeReview?.diff ? writeReview.diff.split('\n') : [];
  const hasVersionTimeline = Boolean(versionSnapshots || versionMessage || versionBusy);
  const canCompareVersions = Boolean(onCompareLatestVersions && versionSnapshots && versionSnapshots.length >= 2 && !versionBusy);
  const writeReviewPanel = writeReview ? (
    <section className="vault-write-review" role="region" aria-label="Source Guard review">
      <div className="vault-write-review-head">
        <div>
          <p className="eyebrow">Source Guard review</p>
          <strong>{writeReview.status === 'changed' ? 'Changes detected' : 'No source changes'}</strong>
        </div>
        <small>{writeReview.sourcePath}</small>
      </div>
      <pre className="vault-diff" aria-label="Readable HTML diff">
        {diffLines.length ? (
          diffLines.map((line, index) => (
            <code key={`${index}-${line}`} data-diff={line.startsWith('+') ? 'add' : line.startsWith('-') ? 'remove' : 'same'}>
              {line}
            </code>
          ))
        ) : (
          <code data-diff="same">No textual diff</code>
        )}
      </pre>
      <div className="vault-write-decisions">
        <button type="button" disabled={writeBusy} onClick={onCancelWrite}>
          Cancel write
        </button>
        <button type="button" disabled={writeBusy} onClick={onSaveAs}>
          Save as copy
        </button>
        <button type="button" disabled={writeBusy} onClick={onWriteBack}>
          Write back to source
        </button>
      </div>
    </section>
  ) : null;

  useEffect(() => {
    const firstElement = editableElements[0];
    setSelectedElementSelector(firstElement?.selector ?? '');
    setElementDraft(firstElement?.text ?? '');
    setElementAiInstruction('');
  }, [editableElements]);

  return (
    <section className="vault-home" aria-label={copy.ariaLabel}>
      <aside className="vault-sidebar" aria-label={copy.sidebarLabel}>
        <div className="vault-brand">
          <span className="vault-mark">HV</span>
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1>{copy.title}</h1>
          </div>
        </div>

        <div className="vault-search">
          <Search aria-hidden="true" size={16} />
          <input
            aria-label={copy.search}
            role="searchbox"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.searchPlaceholder}
          />
        </div>

        <nav className="vault-tree" aria-label={copy.tree} role="tree">
          {treeRows.map((row) =>
            row.type === 'folder' ? (
              <button
                key={row.id}
                type="button"
                role="treeitem"
                aria-level={row.depth + 1}
                aria-label={copy.openFolder(row.path)}
                className={folder === row.path ? 'vault-tree-row folder active' : 'vault-tree-row folder'}
                style={{ '--depth': row.depth } as CSSProperties}
                onClick={() => setFolder(folder === row.path ? '' : row.path)}
              >
                <Folder size={15} aria-hidden="true" />
                <span>{row.label}</span>
                <small>{row.itemCount}</small>
              </button>
            ) : (
              <button
                key={row.id}
                type="button"
                role="treeitem"
                aria-level={row.depth + 1}
                aria-label={row.label}
                aria-selected={activeItemId === row.item.id}
                className={activeItemId === row.item.id ? 'vault-tree-row item active' : 'vault-tree-row item'}
                style={{ '--depth': row.depth } as CSSProperties}
                onClick={() => onOpenItem?.(row.item.id)}
              >
                <FileText size={14} aria-hidden="true" />
                <span>{row.label}</span>
              </button>
            ),
          )}
        </nav>

        <div className="vault-filter-block">
          <div className="vault-filter-title">
            <SlidersHorizontal size={14} aria-hidden="true" />
            <span>{copy.tags}</span>
          </div>
          <div className="vault-token-grid">
            {tags.map((itemTag) => (
              <button
                key={itemTag}
                type="button"
                className={tag === itemTag ? 'vault-token active' : 'vault-token'}
                aria-label={`Filter tag ${itemTag}`}
                onClick={() => setTag(tag === itemTag ? '' : itemTag)}
              >
                {itemTag}
              </button>
            ))}
          </div>
        </div>

        <div className="vault-filter-block">
          <div className="vault-filter-title">{copy.sources}</div>
          <div className="vault-token-grid">
            {sourceAgents.map((agent) => (
              <button
                key={agent}
                type="button"
                className={sourceAgent === agent ? 'vault-token active' : 'vault-token'}
                aria-label={`Filter source ${agent}`}
                onClick={() => setSourceAgent(sourceAgent === agent ? '' : agent)}
              >
                {agent}
              </button>
            ))}
          </div>
        </div>

        {onConfirmInboxRequest && onDismissInboxRequest ? (
          <InboxPanel
            requests={inboxRequests}
            invalidLines={inboxInvalidLines}
            skippedDuplicates={inboxSkippedDuplicates}
            busyRequestIds={inboxBusyRequestIds}
            onConfirm={onConfirmInboxRequest}
            onDismiss={onDismissInboxRequest}
          />
        ) : null}
      </aside>

      <div className="vault-main">
        <header className="vault-toolbar">
          <div>
            <p className="eyebrow">{copy.library}</p>
            <h2>{visibleItems.length} {copy.assets}</h2>
          </div>
          <div className="vault-toolbar-actions">
            {canGenerateThumbnails ? (
              <button
                type="button"
                className="vault-thumbnail-action"
                aria-label={thumbnailButtonLabel}
                disabled={thumbnailBusy}
                onClick={onGenerateThumbnails}
              >
                <RefreshCw size={15} aria-hidden="true" />
                <span>{thumbnailBusy ? copy.rendering : copy.generate}</span>
              </button>
            ) : null}
            {onGenerateThumbnails ? <span className="vault-toolbar-status">{thumbnailStatusText}</span> : null}
            <button type="button" className="icon-button" aria-label={copy.cardView} aria-pressed={viewMode === 'card'} onClick={() => setViewMode('card')}>
              <Grid2X2 size={16} aria-hidden="true" />
            </button>
            <button type="button" className="icon-button" aria-label={copy.listView} aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')}>
              <List size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={clearFilters} aria-label={copy.clearFilters}>
              {copy.clear}
            </button>
          </div>
        </header>

        <div className={previewHtml ? 'vault-main-body with-preview' : 'vault-main-body'}>
          <div className="vault-items" data-testid="vault-items" data-view={viewMode}>
            {visibleItems.map((item) => {
              const exportResult = exportResults?.[item.id];

              return (
                <article
                  className={activeItemId === item.id ? 'vault-item active' : 'vault-item'}
                  key={item.id}
                  data-testid={`vault-item-${item.id}`}
                >
                <div className="vault-thumb" data-status={item.thumbnail.status}>
                  <FileText size={22} aria-hidden="true" />
                  <span>Thumbnail {item.thumbnail.status}</span>
                </div>
                <div className="vault-item-body">
                  <div className="vault-item-heading">
                    <h3>{item.title}</h3>
                    <time dateTime={item.updatedAt}>{formatTime(item.updatedAt)}</time>
                  </div>
                  <p>{item.summary || item.relativeSourcePath}</p>
                  <div className="vault-meta-row">
                    <span>{item.kind}</span>
                    {item.sourceAgent ? <span>{item.sourceAgent}</span> : null}
                    <span>{displayFolderPath(item)}</span>
                  </div>
                  <div className="vault-tags">
                    {item.tags.map((itemTag) => (
                      <span key={itemTag}>{itemTag}</span>
                    ))}
                  </div>
                  {item.kind === 'service' ? (
                    <div className="vault-service-panel">
                      <div className="vault-service-state" data-status={serviceStates?.[item.id]?.status ?? 'unknown'}>
                        <Activity size={13} aria-hidden="true" />
                        <strong>{serviceStates?.[item.id]?.status ?? 'unknown'}</strong>
                        <span>{serviceStates?.[item.id]?.cwd ?? item.sourcePath ?? 'No cwd'}</span>
                      </div>
                      <div className="vault-service-actions">
                        <button
                          type="button"
                          aria-label={`Check service ${item.title}`}
                          disabled={serviceBusyIds.includes(item.id)}
                          onClick={() => onServiceHealth?.(item.id)}
                        >
                          <Activity size={13} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Start service ${item.title}`}
                          disabled={serviceBusyIds.includes(item.id)}
                          onClick={() => onServiceStart?.(item.id)}
                        >
                          <Play size={13} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Stop service ${item.title}`}
                          disabled={serviceBusyIds.includes(item.id)}
                          onClick={() => onServiceStop?.(item.id)}
                        >
                          <Square size={13} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {item.kind === 'html-note' && onScanAssetIntegrity ? (
                    <div className="vault-asset-panel">
                      <div className="vault-asset-head" data-safe={assetReports?.[item.id]?.safeModeRequired ? 'false' : 'true'}>
                        <ShieldAlert size={13} aria-hidden="true" />
                        <strong>{assetReports?.[item.id]?.safeModeRequired ? 'Safe mode required' : 'Assets unchecked'}</strong>
                        <button
                          type="button"
                          aria-label={`Scan assets ${item.title}`}
                          disabled={assetBusyIds.includes(item.id)}
                          onClick={() => onScanAssetIntegrity(item.id)}
                        >
                          Scan
                        </button>
                      </div>
                      {assetReports?.[item.id] ? (
                        <div className="vault-asset-stats">
                          <span>{assetReports[item.id].missingAssets.length} missing</span>
                          <span>{assetReports[item.id].externalResources.length} external</span>
                          <span>{assetReports[item.id].dangerousScripts.length} script</span>
                          <span>{assetReports[item.id].unpublishableResources.length} blocked</span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {item.kind === 'html-note' && (onExportPackage || onExportMarkdown) ? (
                    <div className="vault-export-panel">
                      <div className="vault-export-head">
                        <Download size={13} aria-hidden="true" />
                        <strong>
                          {exportResult?.exportType === 'static-package'
                            ? 'Package ready'
                            : exportResult?.exportType === 'markdown'
                              ? 'Markdown ready'
                              : 'Export'}
                        </strong>
                      </div>
                      {exportResult ? (
                        <span className="vault-export-path">
                          {exportResult.exportType === 'static-package' ? exportResult.outputDir : exportResult.outputPath}
                        </span>
                      ) : null}
                      <div className="vault-export-actions">
                        {onExportPackage ? (
                          <button
                            type="button"
                            aria-label={`Export package ${item.title}`}
                            disabled={exportBusyIds.includes(item.id)}
                            onClick={() => onExportPackage(item.id)}
                          >
                            Package
                          </button>
                        ) : null}
                        {onExportMarkdown ? (
                          <button
                            type="button"
                            aria-label={`Export Markdown ${item.title}`}
                            disabled={exportBusyIds.includes(item.id)}
                            onClick={() => onExportMarkdown(item.id)}
                          >
                            Markdown
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {item.kind === 'markdown-note' && onConvertMarkdownToHtml ? (
                    <div className="vault-export-panel">
                      <div className="vault-export-head">
                        <FileText size={13} aria-hidden="true" />
                        <strong>HTML version</strong>
                      </div>
                      <div className="vault-export-actions">
                        <button
                          type="button"
                          aria-label={`Convert Markdown to HTML ${item.title}`}
                          disabled={markdownConvertBusyIds.includes(item.id)}
                          onClick={() => onConvertMarkdownToHtml(item.id)}
                        >
                          Convert
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {onOpenItem && (item.kind === 'html-note' || item.kind === 'markdown-note') ? (
                    <button type="button" className="vault-preview-button" aria-label={`Preview ${item.title}`} onClick={() => onOpenItem(item.id)}>
                      <Eye size={14} aria-hidden="true" />
                      <span>Preview</span>
                    </button>
                  ) : null}
                </div>
                </article>
              );
            })}
          </div>

          {previewHtml ? (
            <aside className="vault-preview-panel" aria-label="HTML preview">
              <header className="vault-preview-header">
                <div>
                  <p className="eyebrow">{isEditingPreview ? copy.editableDraft : copy.readOnlyPreview}</p>
                  <h3>{previewTitle}</h3>
                </div>
                {onReviewEdit ? (
                  <button type="button" className="vault-preview-tool" aria-label={copy.editPreview} onClick={startPreviewEdit}>
                    <Pencil size={14} aria-hidden="true" />
                    <span>{copy.edit}</span>
                  </button>
                ) : null}
              </header>
              {isEditingPreview ? (
                <div className="vault-edit-panel">
                  <label className="vault-edit-label" htmlFor="vault-edit-draft">
                    Editable HTML draft
                  </label>
                  <textarea
                    id="vault-edit-draft"
                    className="vault-edit-draft"
                    value={draftHtml}
                    onChange={(event) => setDraftHtml(event.target.value)}
                    spellCheck={false}
                  />
                  <div className="vault-write-actions">
                    <button type="button" disabled={writeBusy} onClick={() => onReviewEdit?.(draftHtml)}>
                      <ShieldCheck size={14} aria-hidden="true" />
                      <span>Review changes</span>
                    </button>
                    {writeMessage ? <span>{writeMessage}</span> : null}
                  </div>

                  {writeReviewPanel}
                </div>
              ) : (
                <>
                  <iframe className="vault-preview-frame" title="Vault HTML preview" srcDoc={previewHtml} sandbox="allow-same-origin" />
                  {editableElements.length > 0 && onReviewEdit ? (
                    <section className="vault-element-edit-panel" role="region" aria-label="Rendered element editor">
                      <div className="vault-element-edit-grid">
                        <label>
                          <span>Rendered element</span>
                          <select value={selectedElementSelector} onChange={(event) => selectEditableElement(event.target.value)}>
                            {editableElements.map((element) => (
                              <option key={element.selector} value={element.selector}>
                                {element.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Selected element text</span>
                          <textarea value={elementDraft} onChange={(event) => setElementDraft(event.target.value)} />
                        </label>
                      </div>
                      <div className="vault-write-actions">
                        <button type="button" disabled={writeBusy || !selectedElementSelector} onClick={reviewSelectedElementEdit}>
                          <ShieldCheck size={14} aria-hidden="true" />
                          <span>Review selected element change</span>
                        </button>
                      </div>
                      {onRunScopedAiEdit ? (
                        <div className="vault-element-ai-row">
                          <label>
                            <span>AI instruction for selected element</span>
                            <input value={elementAiInstruction} onChange={(event) => setElementAiInstruction(event.target.value)} />
                          </label>
                          <button type="button" disabled={!selectedElementSelector || !elementAiInstruction.trim()} onClick={runScopedAiEdit}>
                            Ask AI to edit selected element
                          </button>
                        </div>
                      ) : null}
                    </section>
                  ) : null}
                  {writeReviewPanel}
                  {hasVersionTimeline ? (
                    <section className="vault-version-panel" role="region" aria-label="Version timeline">
                      <div className="vault-version-head">
                        <div>
                          <p className="eyebrow">Versions</p>
                          <strong>{versionSnapshots?.length ?? 0} snapshots</strong>
                        </div>
                        <button
                          type="button"
                          className="vault-preview-tool"
                          aria-label="Compare latest versions"
                          disabled={!canCompareVersions}
                          onClick={onCompareLatestVersions}
                        >
                          <GitCompare size={14} aria-hidden="true" />
                          <span>Compare</span>
                        </button>
                      </div>
                      <div className="vault-version-list">
                        {versionSnapshots?.length ? (
                          versionSnapshots.map((snapshot) => (
                            <div className="vault-version-row" key={snapshot.snapshotId}>
                              <History size={14} aria-hidden="true" />
                              <div>
                                <strong>{snapshot.reason}</strong>
                                <span>
                                  {formatTime(snapshot.createdAt)} · {snapshot.contentHash.slice(0, 18)}
                                </span>
                              </div>
                              {onRollbackSnapshot ? (
                                <button
                                  type="button"
                                  className="vault-version-rollback"
                                  aria-label={`Rollback to ${snapshot.reason}`}
                                  disabled={versionBusy}
                                  onClick={() => onRollbackSnapshot(snapshot.snapshotId)}
                                >
                                  <RotateCcw size={13} aria-hidden="true" />
                                </button>
                              ) : null}
                            </div>
                          ))
                        ) : (
                          <p className="vault-version-empty">No snapshots yet</p>
                        )}
                      </div>
                      {versionMessage ? <p className="vault-version-message">{versionMessage}</p> : null}
                    </section>
                  ) : null}
                  {versionDiff ? (
                    <section className="vault-version-diff" role="region" aria-label="Version diff">
                      <div className="vault-version-diff-grid">
                        <div>
                          <strong>Source</strong>
                          <pre>
                            {versionDiff.source.removed.map((line) => (
                              <code key={`source-remove-${line}`} data-diff="remove">
                                -{line}
                              </code>
                            ))}
                            {versionDiff.source.added.map((line) => (
                              <code key={`source-add-${line}`} data-diff="add">
                                +{line}
                              </code>
                            ))}
                          </pre>
                        </div>
                        <div>
                          <strong>Content</strong>
                          <pre>
                            {versionDiff.content.removed.map((line) => (
                              <code key={`content-remove-${line}`} data-diff="remove">
                                -{line}
                              </code>
                            ))}
                            {versionDiff.content.added.map((line) => (
                              <code key={`content-add-${line}`} data-diff="add">
                                +{line}
                              </code>
                            ))}
                          </pre>
                        </div>
                        <div>
                          <strong>DOM</strong>
                          <div className="vault-dom-summary">
                            {versionDiff.domSummary.changedTitle ? (
                              <span>
                                {versionDiff.domSummary.changedTitle.from} -&gt; {versionDiff.domSummary.changedTitle.to}
                              </span>
                            ) : null}
                            {versionDiff.domSummary.addedTags.map((tagName) => (
                              <span key={`added-${tagName}`}>{tagName}</span>
                            ))}
                            {versionDiff.domSummary.removedTags.map((tagName) => (
                              <span key={`removed-${tagName}`}>-{tagName}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </section>
                  ) : null}
                </>
              )}
            </aside>
          ) : null}
        </div>
      </div>
    </section>
  );
}
