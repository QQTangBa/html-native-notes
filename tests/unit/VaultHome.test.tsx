import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
});
