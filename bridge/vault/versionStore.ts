import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface VersionSnapshot {
  snapshotId: string;
  assetId: string;
  reason: string;
  createdAt: string;
  contentHash: string;
  contentPath: string;
}

export interface CreateSnapshotOptions {
  vaultDir: string;
  assetId: string;
  sourcePath: string;
  reason: string;
}

export interface DiffSnapshotsOptions {
  vaultDir: string;
  assetId: string;
  fromSnapshotId: string;
  toSnapshotId: string;
}

export interface RollbackOptions {
  vaultDir: string;
  assetId: string;
  snapshotId: string;
  targetPath: string;
}

export interface VersionDiff {
  source: {
    added: string[];
    removed: string[];
  };
  content: {
    added: string[];
    removed: string[];
  };
  domSummary: {
    addedTags: string[];
    removedTags: string[];
    changedTitle?: {
      from: string;
      to: string;
    };
  };
}

function versionDir(vaultDir: string, assetId: string): string {
  assertSafeAssetId(assetId);
  return path.join(vaultDir, '.htmlvault', 'versions', assetId);
}

function snapshotIndexPath(vaultDir: string, assetId: string): string {
  return path.join(versionDir(vaultDir, assetId), 'snapshots.json');
}

function contentHash(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

function httpError(message: string, statusCode: number): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}

function assertSafeAssetId(assetId: string): void {
  if (!/^asset_[A-Za-z0-9_-]+$/.test(assetId)) {
    throw httpError('Invalid asset id', 400);
  }
}

function isInside(parentPath: string, childPath: string, allowEqual = false): boolean {
  const relative = path.relative(parentPath, childPath);
  return (allowEqual && relative === '') || Boolean(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function snapshotIdFor(content: string, reason: string): string {
  return `snap_${createHash('sha256')
    .update(`${reason}:${contentHash(content)}:${Date.now()}`)
    .digest('hex')
    .slice(0, 16)}`;
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tempPath = `${filePath}.tmp`;

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(tempPath, filePath);
}

export async function listVersionSnapshots(vaultDir: string, assetId: string): Promise<VersionSnapshot[]> {
  try {
    return JSON.parse(await readFile(snapshotIndexPath(vaultDir, assetId), 'utf8')) as VersionSnapshot[];
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

export async function createVersionSnapshot(options: CreateSnapshotOptions): Promise<VersionSnapshot> {
  const content = await readFile(options.sourcePath, 'utf8');
  const snapshotId = snapshotIdFor(content, options.reason);
  const dir = versionDir(options.vaultDir, options.assetId);
  const contentPath = path.join(dir, `${snapshotId}.html`);
  const snapshot: VersionSnapshot = {
    snapshotId,
    assetId: options.assetId,
    reason: options.reason,
    createdAt: new Date().toISOString(),
    contentHash: contentHash(content),
    contentPath,
  };
  const snapshots = await listVersionSnapshots(options.vaultDir, options.assetId);

  await mkdir(dir, { recursive: true });
  await writeFile(contentPath, content, 'utf8');
  await writeJsonAtomic(snapshotIndexPath(options.vaultDir, options.assetId), [...snapshots, snapshot]);

  return snapshot;
}

function lineDiff(from: string, to: string): { added: string[]; removed: string[] } {
  const leafElementPattern = /<([a-z][a-z0-9-]*)\b[^>]*>[^<]*<\/\1>/gi;
  const markupPattern = /<[^>]+>|[^<]+/gi;
  const tokenize = (value: string) => {
    const leafElements = Array.from(value.matchAll(leafElementPattern), (match) => match[0].trim()).filter(Boolean);
    const markup = Array.from(value.matchAll(markupPattern), (match) => match[0].trim()).filter(Boolean);

    return [...new Set([...leafElements, ...markup])];
  };
  const fromLines = tokenize(from);
  const toLines = tokenize(to);
  const fromSet = new Set(fromLines);
  const toSet = new Set(toLines);

  return {
    added: toLines.filter((line) => !fromSet.has(line)),
    removed: fromLines.filter((line) => !toSet.has(line)),
  };
}

function readableText(html: string): string[] {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function textDiff(from: string[], to: string[]): { added: string[]; removed: string[] } {
  const fromSet = new Set(from);
  const toSet = new Set(to);

  return {
    added: to.filter((line) => !fromSet.has(line)),
    removed: from.filter((line) => !toSet.has(line)),
  };
}

function tagCounts(html: string): Map<string, number> {
  const counts = new Map<string, number>();
  const tagPattern = /<([a-z][a-z0-9-]*)\b[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(html))) {
    const tag = match[1]?.toLowerCase();
    if (!tag || tag.startsWith('/')) {
      continue;
    }

    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }

  return counts;
}

function titleOf(html: string): string | undefined {
  return /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim();
}

function domSummary(from: string, to: string): VersionDiff['domSummary'] {
  const fromTags = tagCounts(from);
  const toTags = tagCounts(to);
  const addedTags = [...toTags.entries()]
    .filter(([tag, count]) => count > (fromTags.get(tag) ?? 0))
    .map(([tag]) => tag);
  const removedTags = [...fromTags.entries()]
    .filter(([tag, count]) => count > (toTags.get(tag) ?? 0))
    .map(([tag]) => tag);
  const fromTitle = titleOf(from);
  const toTitle = titleOf(to);

  return {
    addedTags,
    removedTags,
    ...(fromTitle && toTitle && fromTitle !== toTitle
      ? {
          changedTitle: {
            from: fromTitle,
            to: toTitle,
          },
        }
      : {}),
  };
}

async function findSnapshot(vaultDir: string, assetId: string, snapshotId: string): Promise<VersionSnapshot> {
  const snapshot = (await listVersionSnapshots(vaultDir, assetId)).find((item) => item.snapshotId === snapshotId);

  if (!snapshot) {
    throw httpError(`Snapshot not found: ${snapshotId}`, 404);
  }

  return snapshot;
}

async function readSnapshotContent(vaultDir: string, assetId: string, snapshot: VersionSnapshot): Promise<string> {
  const [versionDirRealPath, contentRealPath] = await Promise.all([realpath(versionDir(vaultDir, assetId)), realpath(snapshot.contentPath)]);

  if (!isInside(versionDirRealPath, contentRealPath)) {
    throw httpError('Snapshot content path is outside the asset version directory', 400);
  }

  return readFile(contentRealPath, 'utf8');
}

export async function diffVersionSnapshots(options: DiffSnapshotsOptions): Promise<VersionDiff> {
  const fromSnapshot = await findSnapshot(options.vaultDir, options.assetId, options.fromSnapshotId);
  const toSnapshot = await findSnapshot(options.vaultDir, options.assetId, options.toSnapshotId);
  const [from, to] = await Promise.all([
    readSnapshotContent(options.vaultDir, options.assetId, fromSnapshot),
    readSnapshotContent(options.vaultDir, options.assetId, toSnapshot),
  ]);

  return {
    source: lineDiff(from, to),
    content: textDiff(readableText(from), readableText(to)),
    domSummary: domSummary(from, to),
  };
}

export async function rollbackToSnapshot(options: RollbackOptions): Promise<{ restoredHash: string }> {
  const snapshot = await findSnapshot(options.vaultDir, options.assetId, options.snapshotId);
  const content = await readSnapshotContent(options.vaultDir, options.assetId, snapshot);

  await writeFile(options.targetPath, content, 'utf8');

  return {
    restoredHash: contentHash(content),
  };
}
