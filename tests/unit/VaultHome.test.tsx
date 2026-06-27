import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VaultHome, type VaultHomeItem } from '../../src/features/vault/VaultHome';

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
];

describe('VaultHome', () => {
  it('renders a dense desktop Vault home with cards, folders, filters, and thumbnail state', () => {
    render(<VaultHome items={items} />);

    expect(screen.getByRole('heading', { name: 'Vault' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search Vault' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Card view' })).toHaveAttribute('aria-pressed', 'true');
    const folders = screen.getByRole('navigation', { name: 'Folders' });
    expect(within(folders).getByText('imports/ai-agent')).toBeInTheDocument();
    expect(within(folders).getByText('services')).toBeInTheDocument();

    const gutCard = screen.getByTestId('vault-item-asset_gut');
    expect(within(gutCard).getByText('Gut Market Research')).toBeInTheDocument();
    expect(within(gutCard).getByText('codex')).toBeInTheDocument();
    expect(within(gutCard).getByText('research')).toBeInTheDocument();
    expect(within(gutCard).getByText('Thumbnail pending')).toBeInTheDocument();

    const dashboardCard = screen.getByTestId('vault-item-asset_dashboard');
    expect(within(dashboardCard).getByText('Revenue Dashboard')).toBeInTheDocument();
    expect(within(dashboardCard).getByText('Thumbnail ready')).toBeInTheDocument();
  });

  it('filters by query, tag, source agent, and folder while supporting list view', () => {
    render(<VaultHome items={items} />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search Vault' }), { target: { value: 'revenue' } });
    expect(screen.queryByText('Gut Market Research')).not.toBeInTheDocument();
    expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    fireEvent.click(screen.getByRole('button', { name: 'Filter tag finance' }));
    expect(screen.queryByText('Gut Market Research')).not.toBeInTheDocument();
    expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    fireEvent.click(screen.getByRole('button', { name: 'Filter source codex' }));
    expect(screen.getByText('Gut Market Research')).toBeInTheDocument();
    expect(screen.queryByText('Revenue Dashboard')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open folder services' }));
    expect(screen.queryByText('Gut Market Research')).not.toBeInTheDocument();
    expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();

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
