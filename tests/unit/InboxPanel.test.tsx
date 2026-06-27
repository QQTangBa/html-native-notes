import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InboxPanel } from '../../src/features/bridge/InboxPanel';
import type { NormalizedBridgeRequest } from '../../bridge/shared/protocol';

const htmlRequest: NormalizedBridgeRequest = {
  requestId: 'inbox-html-001',
  type: 'registerHtmlAsset',
  createdAt: '2026-06-27T00:00:00.000Z',
  sourceAgent: 'codex',
  sourcePath: '/Vault/imports/ai/report.html',
  sourceHash: 'sha256:inbox1',
  title: 'Inbox Report',
  tags: ['ai', 'inbox'],
  dedupeKey: 'registerHtmlAsset:sha256:inbox1',
};

const serviceRequest: NormalizedBridgeRequest = {
  requestId: 'inbox-service-001',
  type: 'registerWebService',
  createdAt: '2026-06-27T00:05:00.000Z',
  title: 'Local Dashboard',
  service: {
    title: 'Local Dashboard',
    cwd: '/Vault/services/dashboard',
    startCommand: 'npm run dev',
    url: 'http://127.0.0.1:5173',
  },
  tags: [],
  dedupeKey: 'registerWebService:inbox-service-001',
};

describe('InboxPanel', () => {
  it('renders pending offline inbox requests with duplicate and invalid-line status', () => {
    render(
      <InboxPanel
        requests={[htmlRequest, serviceRequest]}
        invalidLines={[{ lineNumber: 3, reason: 'Invalid JSON' }]}
        skippedDuplicates={['inbox-html-duplicate']}
        busyRequestIds={[]}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Agent Inbox' })).toBeInTheDocument();
    expect(screen.getByText('2 pending')).toBeInTheDocument();
    expect(screen.getByText('1 duplicate')).toBeInTheDocument();
    expect(screen.getByText('1 invalid')).toBeInTheDocument();

    const htmlCard = screen.getByTestId('inbox-request-inbox-html-001');
    expect(within(htmlCard).getByText('Inbox Report')).toBeInTheDocument();
    expect(within(htmlCard).getByText('/Vault/imports/ai/report.html')).toBeInTheDocument();
    expect(within(htmlCard).getByText('codex')).toBeInTheDocument();
    expect(within(htmlCard).getByText('ai')).toBeInTheDocument();

    const serviceCard = screen.getByTestId('inbox-request-inbox-service-001');
    expect(within(serviceCard).getByText('Local Dashboard')).toBeInTheDocument();
    expect(within(serviceCard).getByText('/Vault/services/dashboard')).toBeInTheDocument();
  });

  it('confirms and dismisses individual inbox requests', () => {
    const onConfirm = vi.fn();
    const onDismiss = vi.fn();
    render(
      <InboxPanel
        requests={[htmlRequest]}
        invalidLines={[]}
        skippedDuplicates={[]}
        busyRequestIds={[]}
        onConfirm={onConfirm}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Inbox Report' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Inbox Report' }));

    expect(onConfirm).toHaveBeenCalledWith('inbox-html-001');
    expect(onDismiss).toHaveBeenCalledWith('inbox-html-001');
  });

  it('disables row actions while a request is processing and shows an empty state', () => {
    const { rerender } = render(
      <InboxPanel
        requests={[htmlRequest]}
        invalidLines={[]}
        skippedDuplicates={[]}
        busyRequestIds={['inbox-html-001']}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Confirm Inbox Report' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Dismiss Inbox Report' })).toBeDisabled();

    rerender(
      <InboxPanel
        requests={[]}
        invalidLines={[]}
        skippedDuplicates={[]}
        busyRequestIds={[]}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText('Inbox clear')).toBeInTheDocument();
  });
});
