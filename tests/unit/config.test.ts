import { describe, expect, it } from 'vitest';
import { getSafeAiStatus, loadConfig } from '../../src/server/config';

describe('server config', () => {
  it('uses local-only defaults when optional env vars are missing', () => {
    const config = loadConfig({});

    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(5178);
    expect(config.dataDir).toBe('./data');
    expect(config.ai.temperature).toBe(0.2);
    expect(config.ai.maxTokens).toBe(2048);
  });

  it('reports AI readiness without exposing the API key', () => {
    const config = loadConfig({
      AI_BASE_URL: 'https://api.deepseek.com',
      AI_MODEL: 'deepseek-v4-flash',
      AI_API_KEY: 'sk-secret-value',
      AI_TEMPERATURE: '0.3',
      AI_MAX_TOKENS: '1024',
    });

    expect(config.ai.apiKey).toBe('sk-secret-value');
    expect(getSafeAiStatus(config)).toEqual({
      configured: true,
      baseUrlSet: true,
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-flash',
      apiKeyConfigured: true,
      temperature: 0.3,
      maxTokens: 1024,
    });
    expect(JSON.stringify(getSafeAiStatus(config))).not.toContain('sk-secret-value');
  });

  it('rejects invalid numeric generation settings', () => {
    expect(() =>
      loadConfig({
        AI_TEMPERATURE: 'hot',
      }),
    ).toThrow(/AI_TEMPERATURE must be a number/);

    expect(() =>
      loadConfig({
        APP_PORT: 'nope',
      }),
    ).toThrow(/APP_PORT must be an integer/);
  });
});
