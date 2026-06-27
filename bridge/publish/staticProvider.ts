import { spawn } from 'node:child_process';
import type { PublishProviderConfig, VaultStaticPublishResponse } from '../../src/shared/types';
import { exportVaultAssetStaticPackage } from '../exporter/staticPackage';

interface PublishCommandOutput {
  publicUrl?: unknown;
}

function ensurePublicUrl(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('Publish provider did not return publicUrl');
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Publish provider returned an invalid publicUrl');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Publish provider publicUrl must use http or https');
  }

  return parsed.toString();
}

function parseCommandOutput(stdout: string): PublishCommandOutput {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error('Publish provider did not return JSON output');
  }

  try {
    return JSON.parse(trimmed) as PublishCommandOutput;
  } catch {
    throw new Error('Publish provider returned invalid JSON output');
  }
}

function assertRequiredEnv(provider: Extract<PublishProviderConfig, { mode: 'command' }>, env: NodeJS.ProcessEnv): void {
  const missing = provider.requiredEnv.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`Publish provider is missing required environment variable: ${missing.join(', ')}`);
  }
}

async function runCommandProvider(options: {
  provider: Extract<PublishProviderConfig, { mode: 'command' }>;
  packageDir: string;
  manifestPath: string;
  assetId: string;
}): Promise<string> {
  const env = {
    ...process.env,
    ...options.provider.env,
    HTML_NATIVE_NOTES_PACKAGE_DIR: options.packageDir,
    HTML_NATIVE_NOTES_PUBLISH_MANIFEST: options.manifestPath,
    HTML_NATIVE_NOTES_ASSET_ID: options.assetId,
  };
  assertRequiredEnv(options.provider, env);

  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn(options.provider.command, options.provider.args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdoutChunks: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.once('error', () => reject(new Error('Publish provider command failed')));
    child.once('close', (code) => {
      if (code !== 0) {
        reject(new Error('Publish provider command failed'));
        return;
      }

      resolve(Buffer.concat(stdoutChunks).toString('utf8'));
    });
  });

  return ensurePublicUrl(parseCommandOutput(stdout).publicUrl);
}

export async function publishVaultAssetStatic(options: {
  vaultDir: string;
  assetId: string;
  provider: PublishProviderConfig;
}): Promise<VaultStaticPublishResponse> {
  if (options.provider.mode === 'disabled') {
    throw new Error('Publish provider is not configured');
  }

  const staticPackage = await exportVaultAssetStaticPackage({
    vaultDir: options.vaultDir,
    assetId: options.assetId,
  });
  const publicUrl = await runCommandProvider({
    provider: options.provider,
    packageDir: staticPackage.outputDir,
    manifestPath: staticPackage.manifestPath,
    assetId: staticPackage.assetId,
  });

  return {
    assetId: staticPackage.assetId,
    publishType: 'static-provider',
    provider: options.provider.mode,
    publicUrl,
    package: staticPackage,
    publishedAt: new Date().toISOString(),
  };
}
