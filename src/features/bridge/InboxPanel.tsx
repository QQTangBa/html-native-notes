import { Check, Inbox, X } from 'lucide-react';
import type { InvalidInboxLine } from '../../../bridge/inbox/jsonlInbox';
import type { NormalizedBridgeRequest } from '../../../bridge/shared/protocol';

export interface InboxPanelProps {
  requests: NormalizedBridgeRequest[];
  invalidLines: InvalidInboxLine[];
  skippedDuplicates: string[];
  busyRequestIds: string[];
  onConfirm: (requestId: string) => void;
  onDismiss: (requestId: string) => void;
}

function requestTitle(request: NormalizedBridgeRequest): string {
  const serviceTitle = typeof request.service?.title === 'string' ? request.service.title : undefined;
  return request.title ?? serviceTitle ?? request.sourcePath?.split('/').at(-1) ?? request.requestId;
}

function requestPath(request: NormalizedBridgeRequest): string {
  const serviceCwd = typeof request.service?.cwd === 'string' ? request.service.cwd : undefined;
  return request.sourcePath ?? serviceCwd ?? 'No source path';
}

function requestKindLabel(request: NormalizedBridgeRequest): string {
  if (request.type === 'registerHtmlAsset') {
    return 'HTML';
  }

  if (request.type === 'registerWebService') {
    return 'Service';
  }

  return request.type;
}

export function InboxPanel({
  requests,
  invalidLines,
  skippedDuplicates,
  busyRequestIds,
  onConfirm,
  onDismiss,
}: InboxPanelProps) {
  return (
    <section className="inbox-panel" aria-label="Agent Inbox">
      <div className="inbox-panel-head">
        <div className="inbox-title">
          <Inbox aria-hidden="true" size={16} />
          <div>
            <p className="eyebrow">Bridge</p>
            <h2>Agent Inbox</h2>
          </div>
        </div>
        <div className="inbox-counters" aria-label="Inbox status">
          <span>{`${requests.length} pending`}</span>
          {skippedDuplicates.length > 0 ? <span>{skippedDuplicates.length} duplicate</span> : null}
          {invalidLines.length > 0 ? <span>{invalidLines.length} invalid</span> : null}
        </div>
      </div>

      {requests.length ? (
        <div className="inbox-list">
          {requests.map((request) => {
            const title = requestTitle(request);
            const busy = busyRequestIds.includes(request.requestId);

            return (
              <article className="inbox-request" data-testid={`inbox-request-${request.requestId}`} key={request.requestId}>
                <div className="inbox-request-main">
                  <span className="inbox-kind">{requestKindLabel(request)}</span>
                  <strong>{title}</strong>
                  <code>{requestPath(request)}</code>
                </div>
                <div className="inbox-meta">
                  {request.sourceAgent ? <span>{request.sourceAgent}</span> : null}
                  {request.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <div className="inbox-actions">
                  <button type="button" disabled={busy} aria-label={`Confirm ${title}`} onClick={() => onConfirm(request.requestId)}>
                    <Check aria-hidden="true" size={14} />
                    Confirm
                  </button>
                  <button type="button" disabled={busy} aria-label={`Dismiss ${title}`} onClick={() => onDismiss(request.requestId)}>
                    <X aria-hidden="true" size={14} />
                    Dismiss
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="inbox-empty">Inbox clear</p>
      )}

      {invalidLines.length > 0 ? (
        <div className="inbox-warning" aria-label="Invalid inbox lines">
          {invalidLines.map((line) => (
            <span key={line.lineNumber}>
              Line {line.lineNumber}: {line.reason}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
