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
      <span>{label}</span>
      {status?.model ? <code>{status.model}</code> : <code>.env.local</code>}
    </section>
  );
}
