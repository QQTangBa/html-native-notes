import {
  Eye,
  FileText,
  Folder,
  GitCompare,
  Grid2X2,
  History,
  List,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { VaultVersionDiff, VaultVersionSnapshot, VaultWriteReview } from '../../shared/types';

export interface VaultHomeItem {
  id: string;
  kind: 'html-note' | 'service' | 'project';
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
  thumbnailBusy?: boolean;
  thumbnailMessage?: string;
  onOpenItem?: (itemId: string) => void;
  onGenerateThumbnails?: () => void;
  onCompareLatestVersions?: () => void;
  onRollbackSnapshot?: (snapshotId: string) => void;
  onReviewEdit?: (editedHtml: string) => void;
  onCancelWrite?: () => void;
  onSaveAs?: () => void;
  onWriteBack?: () => void;
}

type ViewMode = 'card' | 'list';

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
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function pendingThumbnailLabel(count: number): string {
  return `${count} pending thumbnail${count === 1 ? '' : 's'}`;
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
  thumbnailBusy = false,
  thumbnailMessage,
  onOpenItem,
  onGenerateThumbnails,
  onCompareLatestVersions,
  onRollbackSnapshot,
  onReviewEdit,
  onCancelWrite,
  onSaveAs,
  onWriteBack,
}: VaultHomeProps) {
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const [sourceAgent, setSourceAgent] = useState('');
  const [folder, setFolder] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [isEditingPreview, setIsEditingPreview] = useState(false);
  const [draftHtml, setDraftHtml] = useState('');

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
  const folders = useMemo(() => uniqueSorted(items.map((item) => item.folderPath)), [items]);
  const pendingThumbnailCount = useMemo(() => items.filter((item) => item.thumbnail.status === 'pending').length, [items]);
  const visibleItems = useMemo(
    () =>
      items
        .filter((item) => matchesQuery(item, query))
        .filter((item) => !tag || item.tags.includes(tag))
        .filter((item) => !sourceAgent || item.sourceAgent === sourceAgent)
        .filter((item) => !folder || item.folderPath === folder)
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

  const canGenerateThumbnails = Boolean(onGenerateThumbnails && pendingThumbnailCount > 0);
  const thumbnailButtonLabel = thumbnailBusy ? 'Rendering thumbnails' : `Generate ${pendingThumbnailLabel(pendingThumbnailCount)}`;
  const thumbnailStatusText = thumbnailMessage ?? (pendingThumbnailCount > 0 ? pendingThumbnailLabel(pendingThumbnailCount) : 'Thumbnails ready');
  const diffLines = writeReview?.diff ? writeReview.diff.split('\n') : [];
  const hasVersionTimeline = Boolean(versionSnapshots || versionMessage || versionBusy);
  const canCompareVersions = Boolean(onCompareLatestVersions && versionSnapshots && versionSnapshots.length >= 2 && !versionBusy);

  return (
    <section className="vault-home" aria-label="Vault home">
      <aside className="vault-sidebar" aria-label="Vault folders and filters">
        <div className="vault-brand">
          <span className="vault-mark">HV</span>
          <div>
            <p className="eyebrow">HTML Vault</p>
            <h1>Vault</h1>
          </div>
        </div>

        <div className="vault-search">
          <Search aria-hidden="true" size={16} />
          <input
            aria-label="Search Vault"
            role="searchbox"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, tag, source..."
          />
        </div>

        <nav className="vault-folder-list" aria-label="Folders">
          {folders.map((folderPath) => (
            <button
              key={folderPath}
              type="button"
              className={folder === folderPath ? 'vault-folder active' : 'vault-folder'}
              aria-label={`Open folder ${folderPath}`}
              onClick={() => setFolder(folder === folderPath ? '' : folderPath)}
            >
              <Folder size={15} aria-hidden="true" />
              <span>{folderPath}</span>
              <small>{items.filter((item) => item.folderPath === folderPath).length}</small>
            </button>
          ))}
        </nav>

        <div className="vault-filter-block">
          <div className="vault-filter-title">
            <SlidersHorizontal size={14} aria-hidden="true" />
            <span>Tags</span>
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
          <div className="vault-filter-title">Sources</div>
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
      </aside>

      <div className="vault-main">
        <header className="vault-toolbar">
          <div>
            <p className="eyebrow">Library</p>
            <h2>{visibleItems.length} assets</h2>
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
                <span>{thumbnailBusy ? 'Rendering' : 'Generate'}</span>
              </button>
            ) : null}
            {onGenerateThumbnails ? <span className="vault-toolbar-status">{thumbnailStatusText}</span> : null}
            <button type="button" className="icon-button" aria-label="Card view" aria-pressed={viewMode === 'card'} onClick={() => setViewMode('card')}>
              <Grid2X2 size={16} aria-hidden="true" />
            </button>
            <button type="button" className="icon-button" aria-label="List view" aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')}>
              <List size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={clearFilters} aria-label="Clear filters">
              Clear
            </button>
          </div>
        </header>

        <div className={previewHtml ? 'vault-main-body with-preview' : 'vault-main-body'}>
          <div className="vault-items" data-testid="vault-items" data-view={viewMode}>
            {visibleItems.map((item) => (
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
                    <span>{item.folderPath}</span>
                  </div>
                  <div className="vault-tags">
                    {item.tags.map((itemTag) => (
                      <span key={itemTag}>{itemTag}</span>
                    ))}
                  </div>
                  {onOpenItem && item.kind === 'html-note' ? (
                    <button type="button" className="vault-preview-button" aria-label={`Preview ${item.title}`} onClick={() => onOpenItem(item.id)}>
                      <Eye size={14} aria-hidden="true" />
                      <span>Preview</span>
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          {previewHtml ? (
            <aside className="vault-preview-panel" aria-label="HTML preview">
              <header className="vault-preview-header">
                <div>
                  <p className="eyebrow">{isEditingPreview ? 'Editable draft' : 'Read-only preview'}</p>
                  <h3>{previewTitle}</h3>
                </div>
                {onReviewEdit ? (
                  <button type="button" className="vault-preview-tool" aria-label="Edit preview HTML" onClick={startPreviewEdit}>
                    <Pencil size={14} aria-hidden="true" />
                    <span>Edit</span>
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

                  {writeReview ? (
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
                            <code
                              key={`${index}-${line}`}
                              data-diff={line.startsWith('+') ? 'add' : line.startsWith('-') ? 'remove' : 'same'}
                            >
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
                  ) : null}
                </div>
              ) : (
                <>
                  <iframe className="vault-preview-frame" title="Vault HTML preview" srcDoc={previewHtml} sandbox="allow-same-origin" />
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
