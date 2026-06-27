import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VaultHome, type VaultHomeItem } from '../../src/features/vault/VaultHome';
import type { NormalizedBridgeRequest } from '../../bridge/shared/protocol';
import { appCopy } from '../../src/shared/i18n';

const items: VaultHomeItem[] = [
  {
    id: 'asset_gut',
    kind: 'html-note',
    title: 'Gut Market Research',
    sourceAgent: 'codex',
    sourcePath: '/Vault/imports/ai-agent/gut-report.html',
    relativeSourcePath: 'imports/ai-agent/gut-report.html',
    folderPath: 'imports/ai-agent',
    tags: ['research', 'ai', 'gut'],
    summary: 'AI generated market report for gut health tools',
    updatedAt: '2026-06-27T00:00:00.000Z',
    thumbnail: {
      status: 'pending',
      path: '/Vault/.htmlvault/thumbnails/asset_gut.png',
    },
  },
  {
    id: 'asset_dashboard',
    kind: 'service',
    title: 'Revenue Dashboard',
    sourceAgent: 'cursor',
    sourcePath: '/Vault/services/revenue-dashboard',
    relativeSourcePath: 'services/revenue-dashboard',
    folderPath: 'services',
    tags: ['finance', 'dashboard'],
    summary: 'Local dashboard for recurring revenue',
    updatedAt: '2026-06-27T00:10:00.000Z',
    thumbnail: {
      status: 'ready',
      path: '/Vault/.htmlvault/thumbnails/asset_dashboard.png',
    },
  },
  {
    id: 'asset_markdown',
    kind: 'markdown-note',
    title: 'Markdown Strategy Note',
    sourceAgent: 'codex',
    sourcePath: '/Vault/imports/ai-agent/strategy.md',
    relativeSourcePath: 'imports/ai-agent/strategy.md',
    folderPath: 'imports/ai-agent',
    tags: ['strategy', 'markdown'],
    summary: 'AI generated Markdown strategy note',
    updatedAt: '2026-06-27T00:20:00.000Z',
    thumbnail: {
      status: 'pending',
      path: '/Vault/.htmlvault/thumbnails/asset_markdown.png',
    },
  },
];

const inboxRequest: NormalizedBridgeRequest = {
  requestId: 'inbox-html-001',
  type: 'registerHtmlAsset',
  createdAt: '2026-06-27T00:00:00.000Z',
  sourceAgent: 'codex',
  sourcePath: '/Vault/imports/ai/inbox-report.html',
  sourceHash: 'sha256:inbox1',
  title: 'Inbox Report',
  tags: ['ai', 'review'],
  dedupeKey: 'registerHtmlAsset:sha256:inbox1',
};

describe('VaultHome', () => {
  it('renders a dense desktop Vault home with cards, folders, filters, and thumbnail state', () => {
    render(<VaultHome items={items} />);

    expect(screen.getByRole('heading', { name: 'Vault' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search Vault' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Card view' })).toHaveAttribute('aria-pressed', 'true');
    const tree = screen.getByRole('tree', { name: 'Vault tree' });
    expect(within(tree).getByText('imports')).toBeInTheDocument();
    expect(within(tree).getByText('ai-agent')).toBeInTheDocument();
    expect(within(tree).getByRole('treeitem', { name: 'Gut Market Research' })).toBeInTheDocument();
    expect(within(tree).getByRole('treeitem', { name: 'Revenue Dashboard' })).toBeInTheDocument();

    const gutCard = screen.getByTestId('vault-item-asset_gut');
    expect(within(gutCard).getByText('Gut Market Research')).toBeInTheDocument();
    expect(within(gutCard).getByText('codex')).toBeInTheDocument();
    expect(within(gutCard).getByText('research')).toBeInTheDocument();
    expect(within(gutCard).getByText('Thumbnail pending')).toBeInTheDocument();

    const dashboardCard = screen.getByTestId('vault-item-asset_dashboard');
    expect(within(dashboardCard).getByText('Revenue Dashboard')).toBeInTheDocument();
    expect(within(dashboardCard).getByText('Thumbnail ready')).toBeInTheDocument();
  });

  it('renders the core Vault reading surface in Chinese when localized', () => {
    render(<VaultHome items={items} copy={appCopy.zh.vault} />);

    expect(screen.getByRole('heading', { name: '笔记库' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: '搜索笔记库' })).toBeInTheDocument();
    expect(screen.getByText('标签')).toBeInTheDocument();
    expect(screen.getByText('来源')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '3 资产' })).toBeInTheDocument();
  });

  it('renders native manifest unix timestamps without crashing the Vault list', () => {
    render(
      <VaultHome
        items={[
          {
            ...items[0],
            id: 'asset_native_unix',
            title: 'Native Unix Timestamp Report',
            updatedAt: 'unix:1782544234',
          },
        ]}
      />,
    );

    const card = screen.getByTestId('vault-item-asset_native_unix');
    expect(within(card).getByText('Native Unix Timestamp Report')).toBeInTheDocument();
    expect(within(card).getByRole('time')).toHaveTextContent(/\d{2}\/\d{2}/);
  });

  it('hides local absolute paths from the Obsidian-style Vault tree', () => {
    render(
      <VaultHome
        items={[
          {
            id: 'asset_smoke',
            kind: 'html-note',
            title: 'Codex Smoke Report',
            sourceAgent: 'codex',
            sourcePath:
              '/Users/siter/Documents/HTML原生笔记编辑器/html-native-notes/test-results/desktop-smoke/ai-fixtures/codex-ai-smoke.html',
            relativeSourcePath:
              'Users/siter/Documents/HTML原生笔记编辑器/html-native-notes/test-results/desktop-smoke/ai-fixtures/codex-ai-smoke.html',
            folderPath:
              'Users/siter/Documents/HTML原生笔记编辑器/html-native-notes/test-results/desktop-smoke/ai-fixtures',
            tags: ['desktop-smoke'],
            summary: 'Registered Vault asset',
            updatedAt: 'unix:1782544234',
            thumbnail: { status: 'pending', path: '/vault/.htmlvault/thumbnails/asset_smoke.png' },
          },
        ]}
      />,
    );

    const tree = screen.getByRole('tree', { name: 'Vault tree' });
    expect(within(tree).queryByText('Users')).not.toBeInTheDocument();
    expect(within(tree).getByText('desktop-smoke')).toBeInTheDocument();
    expect(within(tree).getByText('ai-fixtures')).toBeInTheDocument();
    expect(within(tree).getByRole('treeitem', { name: 'Codex Smoke Report' })).toBeInTheDocument();
  });

  it('filters by query, tag, source agent, and folder while supporting list view', () => {
    render(<VaultHome items={items} />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search Vault' }), { target: { value: 'revenue' } });
    expect(within(screen.getByTestId('vault-items')).queryByText('Gut Market Research')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('vault-items')).getByText('Revenue Dashboard')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    fireEvent.click(screen.getByRole('button', { name: 'Filter tag finance' }));
    expect(within(screen.getByTestId('vault-items')).queryByText('Gut Market Research')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('vault-items')).getByText('Revenue Dashboard')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    fireEvent.click(screen.getByRole('button', { name: 'Filter source codex' }));
    expect(within(screen.getByTestId('vault-items')).getByText('Gut Market Research')).toBeInTheDocument();
    expect(within(screen.getByTestId('vault-items')).queryByText('Revenue Dashboard')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    fireEvent.click(screen.getByRole('treeitem', { name: 'Open folder services' }));
    expect(within(screen.getByTestId('vault-items')).queryByText('Gut Market Research')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('vault-items')).getByText('Revenue Dashboard')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('vault-items')).toHaveAttribute('data-view', 'list');
  });

  it('shows a compact thumbnail generation action when thumbnails are pending', () => {
    const onGenerateThumbnails = vi.fn();
    render(<VaultHome items={items} thumbnailBusy={false} thumbnailMessage="1 pending" onGenerateThumbnails={onGenerateThumbnails} />);

    const button = screen.getByRole('button', { name: 'Generate 1 pending thumbnail' });
    expect(button).toBeInTheDocument();
    expect(screen.getByText('1 pending')).toBeInTheDocument();

    fireEvent.click(button);
    expect(onGenerateThumbnails).toHaveBeenCalledTimes(1);
  });

  it('lets Markdown notes open as rendered previews and convert into HTML assets', () => {
    const onOpenItem = vi.fn();
    const onConvertMarkdownToHtml = vi.fn();

    render(<VaultHome items={items} onOpenItem={onOpenItem} onConvertMarkdownToHtml={onConvertMarkdownToHtml} />);

    const markdownCard = screen.getByTestId('vault-item-asset_markdown');
    fireEvent.click(within(markdownCard).getByRole('button', { name: 'Preview Markdown Strategy Note' }));
    fireEvent.click(within(markdownCard).getByRole('button', { name: 'Convert Markdown to HTML Markdown Strategy Note' }));

    expect(onOpenItem).toHaveBeenCalledWith('asset_markdown');
    expect(onConvertMarkdownToHtml).toHaveBeenCalledWith('asset_markdown');
  });

  it('reviews manual and AI-scoped edits from selected rendered HTML elements', () => {
    const onReviewEdit = vi.fn();
    const onRunScopedAiEdit = vi.fn();

    render(
      <VaultHome
        items={items}
        previewHtml="<main><h1>Preview title</h1><p>Original paragraph.</p></main>"
        previewTitle="Preview"
        onReviewEdit={onReviewEdit}
        onRunScopedAiEdit={onRunScopedAiEdit}
      />,
    );

    fireEvent.change(screen.getByLabelText('Rendered element'), { target: { value: 'main > p:nth-of-type(1)' } });
    fireEvent.change(screen.getByLabelText('Selected element text'), { target: { value: 'Edited paragraph.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review selected element change' }));

    expect(onReviewEdit).toHaveBeenCalledWith('<main><h1>Preview title</h1><p>Edited paragraph.</p></main>');

    fireEvent.change(screen.getByLabelText('AI instruction for selected element'), { target: { value: 'Make it shorter' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI to edit selected element' }));
    expect(onRunScopedAiEdit).toHaveBeenCalledWith({
      selector: 'main > p:nth-of-type(1)',
      instruction: 'Make it shorter',
    });
  });

  it('renders the Agent Inbox review panel in the Vault sidebar', () => {
    const onConfirmInboxRequest = vi.fn();
    const onDismissInboxRequest = vi.fn();

    render(
      <VaultHome
        items={items}
        inboxRequests={[inboxRequest]}
        inboxInvalidLines={[{ lineNumber: 7, reason: 'Invalid JSON' }]}
        inboxSkippedDuplicates={['duplicate-request']}
        inboxBusyRequestIds={[]}
        onConfirmInboxRequest={onConfirmInboxRequest}
        onDismissInboxRequest={onDismissInboxRequest}
      />,
    );

    const inbox = screen.getByRole('region', { name: 'Agent Inbox' });
    expect(within(inbox).getByText('Inbox Report')).toBeInTheDocument();
    expect(within(inbox).getByText('1 pending')).toBeInTheDocument();
    expect(within(inbox).getByText('1 duplicate')).toBeInTheDocument();
    expect(within(inbox).getByText('1 invalid')).toBeInTheDocument();

    fireEvent.click(within(inbox).getByRole('button', { name: 'Confirm Inbox Report' }));
    fireEvent.click(within(inbox).getByRole('button', { name: 'Dismiss Inbox Report' }));

    expect(onConfirmInboxRequest).toHaveBeenCalledWith('inbox-html-001');
    expect(onDismissInboxRequest).toHaveBeenCalledWith('inbox-html-001');
  });

  it('shows service runtime status and actions on service cards', () => {
    const onServiceHealth = vi.fn();
    const onServiceStart = vi.fn();
    const onServiceStop = vi.fn();
    render(
      <VaultHome
        items={items}
        serviceStates={{
          asset_dashboard: {
            status: 'stopped',
            serviceId: 'svc_revenue',
            cwd: '/Vault/services/revenue-dashboard',
            command: 'npm run dev',
            logPath: '/Vault/services/revenue-dashboard/service.log',
            startedByApp: false,
          },
        }}
        onServiceHealth={onServiceHealth}
        onServiceStart={onServiceStart}
        onServiceStop={onServiceStop}
      />,
    );

    const dashboardCard = screen.getByTestId('vault-item-asset_dashboard');
    expect(within(dashboardCard).getByText('stopped')).toBeInTheDocument();
    expect(within(dashboardCard).getByText('/Vault/services/revenue-dashboard')).toBeInTheDocument();

    fireEvent.click(within(dashboardCard).getByRole('button', { name: 'Check service Revenue Dashboard' }));
    fireEvent.click(within(dashboardCard).getByRole('button', { name: 'Start service Revenue Dashboard' }));
    fireEvent.click(within(dashboardCard).getByRole('button', { name: 'Stop service Revenue Dashboard' }));

    expect(onServiceHealth).toHaveBeenCalledWith('asset_dashboard');
    expect(onServiceStart).toHaveBeenCalledWith('asset_dashboard');
    expect(onServiceStop).toHaveBeenCalledWith('asset_dashboard');
  });

  it('shows asset integrity scan actions and risk summaries on HTML note cards', () => {
    const onScanAssetIntegrity = vi.fn();
    render(
      <VaultHome
        items={items}
        assetReports={{
          asset_gut: {
            htmlPath: '/Vault/imports/ai-agent/gut-report.html',
            sourceHash: 'sha256:risk',
            missingAssets: [{ kind: 'image', reference: './missing.png', resolvedPath: '/Vault/imports/ai-agent/missing.png' }],
            externalResources: [{ kind: 'script', reference: 'https://cdn.example.com/app.js' }],
            dangerousScripts: [{ kind: 'inline-script', reason: 'Inline script execution is unsafe in static safe mode' }],
            unpublishableResources: [{ kind: 'link', reference: 'file:///Users/example/private.html', reason: 'file:// resources cannot be published' }],
            safeModeRequired: true,
          },
        }}
        onScanAssetIntegrity={onScanAssetIntegrity}
      />,
    );

    const gutCard = screen.getByTestId('vault-item-asset_gut');
    expect(within(gutCard).getByText('Safe mode required')).toBeInTheDocument();
    expect(within(gutCard).getByText('1 missing')).toBeInTheDocument();
    expect(within(gutCard).getByText('1 external')).toBeInTheDocument();
    expect(within(gutCard).getByText('1 script')).toBeInTheDocument();
    expect(within(gutCard).getByText('1 blocked')).toBeInTheDocument();

    fireEvent.click(within(gutCard).getByRole('button', { name: 'Scan assets Gut Market Research' }));
    expect(onScanAssetIntegrity).toHaveBeenCalledWith('asset_gut');
  });

  it('shows local export actions and the latest package path on HTML note cards', () => {
    const onExportPackage = vi.fn();
    const onExportMarkdown = vi.fn();
    render(
      <VaultHome
        items={items}
        exportResults={{
          asset_gut: {
            assetId: 'asset_gut',
            exportType: 'static-package',
            outputDir: '/Vault/.htmlvault/exports/asset_gut/latest',
            indexPath: '/Vault/.htmlvault/exports/asset_gut/latest/index.html',
            manifestPath: '/Vault/.htmlvault/exports/asset_gut/latest/manifest.json',
            copiedAssets: [],
            skippedExternal: [],
            sourceHash: 'sha256:exported',
          },
        }}
        onExportPackage={onExportPackage}
        onExportMarkdown={onExportMarkdown}
      />,
    );

    expect(screen.getByText('Package ready')).toBeInTheDocument();
    expect(screen.getByText('/Vault/.htmlvault/exports/asset_gut/latest')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Export package Gut Market Research' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export Markdown Gut Market Research' }));

    expect(onExportPackage).toHaveBeenCalledWith('asset_gut');
    expect(onExportMarkdown).toHaveBeenCalledWith('asset_gut');
  });

  it('disables thumbnail generation while a run is in progress', () => {
    render(<VaultHome items={items} thumbnailBusy thumbnailMessage="Rendering thumbnails" onGenerateThumbnails={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Rendering thumbnails' })).toBeDisabled();
    expect(screen.getByText('Rendering thumbnails')).toBeInTheDocument();
  });

  it('opens a selected HTML item in the preview pane', () => {
    const onOpenItem = vi.fn();
    render(
      <VaultHome
        items={items}
        activeItemId="asset_gut"
        previewHtml="<html><body><h1>Preview Me</h1></body></html>"
        previewTitle="Gut Market Research"
        onOpenItem={onOpenItem}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Preview Gut Market Research' }));
    expect(onOpenItem).toHaveBeenCalledWith('asset_gut');
    expect(screen.getByRole('complementary', { name: 'HTML preview' })).toBeInTheDocument();
    expect(screen.getByTitle('Vault HTML preview')).toHaveAttribute('srcdoc', '<html><body><h1>Preview Me</h1></body></html>');
  });

  it('reviews preview edits through a Source Guard diff panel', () => {
    const onReviewEdit = vi.fn();
    const onCancelWrite = vi.fn();
    const onSaveAs = vi.fn();
    const onWriteBack = vi.fn();
    const editedHtml = '<html><body><h1>Preview Me</h1><p>Edited</p></body></html>';
    render(
      <VaultHome
        items={items}
        activeItemId="asset_gut"
        previewHtml="<html><body><h1>Preview Me</h1><p>Original</p></body></html>"
        previewTitle="Gut Market Research"
        writeReview={{
          sourcePath: '/Vault/imports/ai-agent/gut-report.html',
          expectedSourceHash: 'abc123',
          originalHtml: '<html><body><h1>Preview Me</h1><p>Original</p></body></html>',
          editedHtml,
          status: 'changed',
          diff: ' <html><body><h1>Preview Me</h1>\n-<p>Original</p>\n+<p>Edited</p>',
        }}
        onReviewEdit={onReviewEdit}
        onCancelWrite={onCancelWrite}
        onSaveAs={onSaveAs}
        onWriteBack={onWriteBack}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit preview HTML' }));
    fireEvent.change(screen.getByLabelText('Editable HTML draft'), { target: { value: editedHtml } });
    fireEvent.click(screen.getByRole('button', { name: 'Review changes' }));

    expect(onReviewEdit).toHaveBeenCalledWith(editedHtml);
    expect(screen.getByRole('region', { name: 'Source Guard review' })).toBeInTheDocument();
    expect(screen.getByText('+<p>Edited</p>')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel write' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save as copy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Write back to source' }));

    expect(onCancelWrite).toHaveBeenCalledTimes(1);
    expect(onSaveAs).toHaveBeenCalledTimes(1);
    expect(onWriteBack).toHaveBeenCalledTimes(1);
  });

  it('leaves edit mode when a different preview item opens', () => {
    const { rerender } = render(
      <VaultHome
        items={items}
        activeItemId="asset_gut"
        previewHtml="<html><body><h1>First Preview</h1></body></html>"
        previewTitle="Gut Market Research"
        onReviewEdit={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit preview HTML' }));
    fireEvent.change(screen.getByLabelText('Editable HTML draft'), {
      target: { value: '<html><body><h1>Stale Draft</h1></body></html>' },
    });

    rerender(
      <VaultHome
        items={items}
        activeItemId="asset_dashboard"
        previewHtml="<html><body><h1>Second Preview</h1></body></html>"
        previewTitle="Revenue Dashboard"
        onReviewEdit={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('Editable HTML draft')).not.toBeInTheDocument();
    expect(screen.getByTitle('Vault HTML preview')).toHaveAttribute('srcdoc', '<html><body><h1>Second Preview</h1></body></html>');
  });

  it('shows a version timeline with source, content, and DOM diff actions', () => {
    const onCompareLatestVersions = vi.fn();
    const onRollbackSnapshot = vi.fn();
    render(
      <VaultHome
        items={items}
        activeItemId="asset_gut"
        previewHtml="<html><head><title>V2</title></head><body><h1>Preview Me</h1><p>Beta</p><section>New</section></body></html>"
        previewTitle="Gut Market Research"
        versionSnapshots={[
          {
            snapshotId: 'snap_base',
            assetId: 'asset_gut',
            reason: 'baseline',
            createdAt: '2026-06-27T00:00:00.000Z',
            contentHash: 'sha256:base',
          },
          {
            snapshotId: 'snap_external',
            assetId: 'asset_gut',
            reason: 'external-agent-edit',
            createdAt: '2026-06-27T00:05:00.000Z',
            contentHash: 'sha256:external',
          },
        ]}
        versionDiff={{
          source: {
            added: ['<p>Beta</p>'],
            removed: ['<p>Alpha</p>'],
          },
          content: {
            added: ['Beta'],
            removed: ['Alpha'],
          },
          domSummary: {
            addedTags: ['section'],
            removedTags: [],
            changedTitle: { from: 'V1', to: 'V2' },
          },
        }}
        onCompareLatestVersions={onCompareLatestVersions}
        onRollbackSnapshot={onRollbackSnapshot}
      />,
    );

    const timeline = screen.getByRole('region', { name: 'Version timeline' });
    expect(within(timeline).getByText('baseline')).toBeInTheDocument();
    expect(within(timeline).getByText('external-agent-edit')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Compare latest versions' }));
    expect(onCompareLatestVersions).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('region', { name: 'Version diff' })).toBeInTheDocument();
    expect(screen.getByText('+<p>Beta</p>')).toBeInTheDocument();
    expect(screen.getByText('+Beta')).toBeInTheDocument();
    expect(screen.getByText('section')).toBeInTheDocument();
    expect(screen.getByText('V1 -> V2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Rollback to baseline' }));
    expect(onRollbackSnapshot).toHaveBeenCalledWith('snap_base');
  });
});
