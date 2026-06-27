import { KeyRound } from 'lucide-react';
import { appCopy, type AppCopy } from '../../shared/i18n';
import type { SafeAiStatus } from '../../shared/types';

interface SettingsPanelProps {
  status?: SafeAiStatus;
  copy?: AppCopy['settings'];
}

export function SettingsPanel({ status, copy = appCopy.en.settings }: SettingsPanelProps) {
  const label = status?.configured ? copy.configured : copy.notConfigured;

  return (
    <section className="settings-strip" aria-label={copy.ariaLabel}>
      <KeyRound size={16} />
      <div className="settings-summary">
        <span>{label}</span>
        <div className="settings-chips">
          {status?.baseUrl ? <code>{status.baseUrl}</code> : <code>.env.local</code>}
          {status?.model ? <code>{status.model}</code> : null}
          {typeof status?.temperature === 'number' ? <code>temp {status.temperature}</code> : null}
          {typeof status?.maxTokens === 'number' ? <code>{status.maxTokens} {copy.tokens}</code> : null}
          {status?.apiKeyConfigured ? <code>{copy.keyStored}</code> : <code>{copy.noKey}</code>}
        </div>
      </div>
    </section>
  );
}
