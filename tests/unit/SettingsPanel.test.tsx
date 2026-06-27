import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettingsPanel } from '../../src/features/settings/SettingsPanel';

describe('SettingsPanel', () => {
  it('shows safe BYOK provider details without rendering the API key', () => {
    render(
      <SettingsPanel
        status={{
          configured: true,
          baseUrlSet: true,
          baseUrl: 'https://api.deepseek.com',
          model: 'deepseek-v4-flash',
          apiKeyConfigured: true,
          temperature: 0.2,
          maxTokens: 2048,
        }}
      />,
    );

    expect(screen.getByText('AI 已配置')).toBeInTheDocument();
    expect(screen.getByText('https://api.deepseek.com')).toBeInTheDocument();
    expect(screen.getByText('deepseek-v4-flash')).toBeInTheDocument();
    expect(screen.getByText('temp 0.2')).toBeInTheDocument();
    expect(screen.getByText('2048 tokens')).toBeInTheDocument();
    expect(screen.getByText('key stored')).toBeInTheDocument();
    expect(screen.queryByText(/sk-/)).not.toBeInTheDocument();
  });
});
