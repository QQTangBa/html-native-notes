import { KeyRound } from 'lucide-react';
import type { SafeAiStatus } from '../../shared/types';

interface SettingsPanelProps {
  status?: SafeAiStatus;
}

export function SettingsPanel({ status }: SettingsPanelProps) {
  const label = status?.configured ? 'AI 已配置' : 'AI 未配置';

  return (
    <section className="settings-strip" aria-label="AI settings status">
      <KeyRound size={16} />
      <div className="settings-summary">
        <span>{label}</span>
        <div className="settings-chips">
          {status?.baseUrl ? <code>{status.baseUrl}</code> : <code>.env.local</code>}
          {status?.model ? <code>{status.model}</code> : null}
          {typeof status?.temperature === 'number' ? <code>temp {status.temperature}</code> : null}
          {typeof status?.maxTokens === 'number' ? <code>{status.maxTokens} tokens</code> : null}
          {status?.apiKeyConfigured ? <code>key stored</code> : <code>no key</code>}
        </div>
      </div>
    </section>
  );
}
