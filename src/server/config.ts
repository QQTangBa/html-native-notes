import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { AppConfig, SafeAiStatus } from '../shared/types';

type EnvMap = Record<string, string | undefined>;

function parseNumber(name: string, value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number`);
  }

  return parsed;
}

function parseInteger(name: string, value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer`);
  }

  return parsed;
}

export function loadConfig(env: EnvMap = process.env): AppConfig {
  const appEnv = env.APP_ENV === 'production' || env.APP_ENV === 'test' ? env.APP_ENV : 'development';
  const dataDir = env.DATA_DIR?.trim() || './data';

  return {
    env: appEnv,
    host: env.APP_HOST?.trim() || '127.0.0.1',
    port: parseInteger('APP_PORT', env.APP_PORT, 5178),
    dataDir,
    vaultDir: env.VAULT_DIR?.trim() || path.join(dataDir, 'vault'),
    ai: {
      baseUrl: env.AI_BASE_URL?.trim() || '',
      model: env.AI_MODEL?.trim() || '',
      apiKey: env.AI_API_KEY?.trim() || undefined,
      temperature: parseNumber('AI_TEMPERATURE', env.AI_TEMPERATURE, 0.2),
      maxTokens: parseInteger('AI_MAX_TOKENS', env.AI_MAX_TOKENS, 2048),
    },
  };
}

export function getSafeAiStatus(config: AppConfig): SafeAiStatus {
  const baseUrlSet = config.ai.baseUrl.length > 0;
  const model = config.ai.model.trim() || undefined;

  return {
    configured: baseUrlSet && Boolean(model) && Boolean(config.ai.apiKey),
    baseUrlSet,
    ...(model ? { model } : {}),
  };
}

export function loadEnvFile(filePath = path.resolve(process.cwd(), '.env.local')): EnvMap {
  if (!existsSync(filePath)) {
    return {};
  }

  const env: EnvMap = {};
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    env[key] = rawValue.replace(/^["']|["']$/g, '');
  }

  return env;
}

export function loadRuntimeConfig(): AppConfig {
  return loadConfig({
    ...loadEnvFile(),
    ...process.env,
  });
}
