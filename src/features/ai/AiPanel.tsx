import { Wand2 } from 'lucide-react';
import type { AiAction, SafeAiStatus } from '../../shared/types';

interface AiPanelProps {
  status?: SafeAiStatus;
  busy: boolean;
  result: string;
  onRun: (action: AiAction) => void;
  onInsert: () => void;
}

export function AiPanel({ status, busy, result, onRun, onInsert }: AiPanelProps) {
  return (
    <section className="ai-panel" aria-label="AI actions">
      <div className="panel-header compact">
        <div>
          <p className="eyebrow">AI</p>
          <h2>Actions</h2>
        </div>
        <Wand2 size={18} />
      </div>
      <div className="ai-actions">
        {(['summarize', 'rewrite', 'outline', 'generate-section', 'clean-html'] as AiAction[]).map((action) => (
          <button key={action} type="button" disabled={busy || !status?.configured} onClick={() => onRun(action)}>
            {action}
          </button>
        ))}
      </div>
      <textarea className="ai-result" readOnly value={result} placeholder="AI result review area" />
      <button type="button" onClick={onInsert} disabled={!result} className="insert-button">
        Insert result
      </button>
    </section>
  );
}
