import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeBridgeRequest, type AgentInboxRequestInput, type NormalizedBridgeRequest } from '../shared/protocol';
import { createVersionSnapshot } from './versionStore';

export interface BridgeVaultAsset {
  id: string;
  kind: 'html-note' | 'markdown-note' | 'service' | 'project';
  title: string;
  source: 'bridge';
  sourcePath?: string;
  sourceHash?: string;
  tags: string[];
  dedupeKey: string;
  requestId: string;
  sourceAgent?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BridgeVaultManifest {
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  assets: BridgeVaultAsset[];
}

export interface IntakeOptions {
  vaultDir: string;
  request: AgentInboxRequestInput | NormalizedBridgeRequest;
}

export interface IntakeResult {
  created: boolean;
  manifestPath: string;
  asset: BridgeVaultAsset;
}

function manifestPathFor(vaultDir: string): string {
  return path.join(vaultDir, '.htmlvault', 'manifest.json');
}

function assetIdFor(dedupeKey: string): string {
  return `asset_${createHash('sha256').update(dedupeKey).digest('hex').slice(0, 16)}`;
}

async function hashFile(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

function emptyManifest(now = new Date().toISOString()): BridgeVaultManifest {
  return {
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    assets: [],
  };
}

export async function readVaultManifest(vaultDir: string): Promise<BridgeVaultManifest> {
  const manifestPath = manifestPathFor(vaultDir);

  try {
    return JSON.parse(await readFile(manifestPath, 'utf8')) as BridgeVaultManifest;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return emptyManifest();
    }

    throw error;
  }
}

async function writeVaultManifest(vaultDir: string, manifest: BridgeVaultManifest): Promise<string> {
  const manifestPath = manifestPathFor(vaultDir);
  const tempPath = `${manifestPath}.tmp`;

  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(tempPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await rename(tempPath, manifestPath);

  return manifestPath;
}

async function assertSourceHash(request: NormalizedBridgeRequest): Promise<void> {
  if (!request.sourcePath || !request.sourceHash) {
    return;
  }

  const actualHash = await hashFile(request.sourcePath);

  if (actualHash !== request.sourceHash) {
    throw new Error(`Source hash mismatch for ${request.sourcePath}`);
  }
}

function assetFromRequest(request: NormalizedBridgeRequest, now: string): BridgeVaultAsset {
  const service = request.service as { title?: unknown; cwd?: unknown } | undefined;
  const kind =
    request.type === 'registerWebService' ? 'service' : request.type === 'registerMarkdownAsset' ? 'markdown-note' : 'html-note';
  const title =
    request.title ??
    (typeof service?.title === 'string' ? service.title : undefined) ??
    (request.sourcePath ? path.basename(request.sourcePath) : request.requestId);

  return {
    id: assetIdFor(request.dedupeKey),
    kind,
    title,
    source: 'bridge',
    sourcePath: request.sourcePath ?? (typeof service?.cwd === 'string' ? service.cwd : undefined),
    sourceHash: request.sourceHash,
    tags: request.tags,
    dedupeKey: request.dedupeKey,
    requestId: request.requestId,
    sourceAgent: request.sourceAgent,
    createdAt: now,
    updatedAt: now,
  };
}

export async function intakeBridgeRequestToVault(options: IntakeOptions): Promise<IntakeResult> {
  const request = normalizeBridgeRequest(options.request);
  await assertSourceHash(request);

  const manifest = await readVaultManifest(options.vaultDir);
  const existing = manifest.assets.find((asset) => asset.dedupeKey === request.dedupeKey);

  if (existing) {
    return {
      created: false,
      manifestPath: manifestPathFor(options.vaultDir),
      asset: existing,
    };
  }

  const now = new Date().toISOString();
  const asset = assetFromRequest(request, now);
  const nextManifest: BridgeVaultManifest = {
    ...manifest,
    updatedAt: now,
    assets: [...manifest.assets, asset],
  };

  const manifestPath = await writeVaultManifest(options.vaultDir, nextManifest);

  if ((asset.kind === 'html-note' || asset.kind === 'markdown-note') && asset.sourcePath) {
    await createVersionSnapshot({
      vaultDir: options.vaultDir,
      assetId: asset.id,
      sourcePath: asset.sourcePath,
      reason: 'baseline',
    });
  }

  return {
    created: true,
    manifestPath,
    asset,
  };
}
