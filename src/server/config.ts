import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { AppConfig, PublishProviderConfig, SafeAiStatus } from '../shared/types';

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

function parseStringArray(name: string, value: string | undefined): string[] {
  if (value === undefined || value.trim() === '') {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${name} must be a JSON string array`);
  }

  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
    throw new Error(`${name} must be a JSON string array`);
  }

  return parsed;
}

function parseCsv(value: string | undefined): string[] {
  if (value === undefined || value.trim() === '') {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function loadPublishConfig(env: EnvMap): PublishProviderConfig {
  const mode = env.PUBLISH_PROVIDER_MODE?.trim() || 'disabled';
  if (mode === 'disabled') {
    return { mode: 'disabled' };
  }

  if (mode !== 'command') {
    throw new Error('PUBLISH_PROVIDER_MODE must be disabled or command');
  }

  const command = env.PUBLISH_COMMAND?.trim();
  if (!command) {
    throw new Error('PUBLISH_COMMAND is required when PUBLISH_PROVIDER_MODE=command');
  }

  const requiredEnv = parseCsv(env.PUBLISH_REQUIRED_ENV);
  const providerEnv = Object.fromEntries(
    requiredEnv.flatMap((name) => {
      const value = env[name];
      return value === undefined ? [] : [[name, value]];
    }),
  );

  return {
    mode: 'command',
    command,
    args: parseStringArray('PUBLISH_COMMAND_ARGS', env.PUBLISH_COMMAND_ARGS),
    requiredEnv,
    ...(Object.keys(providerEnv).length > 0 ? { env: providerEnv } : {}),
  };
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
    publish: loadPublishConfig(env),
  };
}

export function getSafeAiStatus(config: AppConfig): SafeAiStatus {
  const baseUrlSet = config.ai.baseUrl.length > 0;
  const model = config.ai.model.trim() || undefined;

  return {
    configured: baseUrlSet && Boolean(model) && Boolean(config.ai.apiKey),
    baseUrlSet,
    ...(baseUrlSet ? { baseUrl: config.ai.baseUrl } : {}),
    ...(model ? { model } : {}),
    apiKeyConfigured: Boolean(config.ai.apiKey),
    temperature: config.ai.temperature,
    maxTokens: config.ai.maxTokens,
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
