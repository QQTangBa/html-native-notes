import { BookMarked, LockKeyhole } from 'lucide-react';
import type { DiaryOrganizationResponse, DiaryOrganizationStyle, SafeAiStatus } from '../../shared/types';

interface DiaryPanelProps {
  status?: SafeAiStatus;
  source: string;
  busy: boolean;
  result?: DiaryOrganizationResponse;
  onOrganize: () => void;
  onInsertStyle: (style: DiaryOrganizationStyle) => void;
}

export function DiaryPanel({ status, source, busy, result, onOrganize, onInsertStyle }: DiaryPanelProps) {
  return (
    <section className="diary-panel" aria-label="Diary organizer">
      <div className="panel-header compact">
        <div>
          <p className="eyebrow">Diary</p>
          <h2>Organizer</h2>
        </div>
        <BookMarked size={18} aria-hidden="true" />
      </div>
      <button type="button" className="diary-run-button" disabled={busy || !status?.configured || !source.trim()} onClick={onOrganize}>
        Organize Diary
      </button>
      {result ? (
        <div className="diary-result-stack">
          <label className="diary-original">
            <span>
              <LockKeyhole size={13} aria-hidden="true" />
              原文已保留
            </span>
            <textarea readOnly value={result.originalText} />
          </label>
          {result.styles.map((style) => (
            <article className="diary-style-card" key={style.style}>
              <div>
                <strong>{style.title}</strong>
                <p>{style.summary}</p>
              </div>
              <button type="button" aria-label={`Insert ${style.title}`} onClick={() => onInsertStyle(style)}>
                Insert
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
