import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { convertMarkdownFileToHtml } from '../markdown/importer';
import { buildHtmlProfile, extractEmbeddedHtmlProfile } from '../profile/htmlProfile';
import { readVaultManifest, type BridgeVaultAsset } from './intake';

export interface VaultLibraryItem {
  id: string;
  kind: BridgeVaultAsset['kind'];
  title: string;
  source: BridgeVaultAsset['source'];
  sourceAgent?: string;
  sourcePath?: string;
  relativeSourcePath?: string;
  folderPath: string;
  tags: string[];
  summary: string;
  updatedAt: string;
  thumbnail: {
    status: 'ready' | 'pending';
    path: string;
  };
}

export interface VaultFolderSummary {
  path: string;
  itemCount: number;
}

export interface VaultLibrary {
  items: VaultLibraryItem[];
  folders: VaultFolderSummary[];
  availableFilters: {
    tags: string[];
    sourceAgents: string[];
    kinds: BridgeVaultAsset['kind'][];
  };
}

export interface BuildVaultLibraryOptions {
  vaultDir: string;
  query?: string;
  tags?: string[];
  sourceAgents?: string[];
  kinds?: BridgeVaultAsset['kind'][];
  folders?: string[];
}

function normalizeRelative(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function mergeTags(...groups: string[][]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const tag of groups.flat().map((item) => item.trim().toLowerCase())) {
    if (!tag || seen.has(tag)) {
      continue;
    }

    seen.add(tag);
    merged.push(tag);
  }

  return merged;
}

function relativeSourcePath(vaultDir: string, sourcePath?: string): string | undefined {
  if (!sourcePath) {
    return undefined;
  }

  const relative = path.relative(vaultDir, sourcePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return normalizeRelative(path.basename(sourcePath));
  }

  return normalizeRelative(relative);
}

function folderFor(relativePath?: string): string {
  if (!relativePath) {
    return '';
  }

  const folder = path.posix.dirname(relativePath);
  return folder === '.' ? '' : folder;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function enrichHtmlAsset(asset: BridgeVaultAsset): Promise<{
  title?: string;
  tags: string[];
  summary: string;
}> {
  if (asset.kind !== 'html-note' || !asset.sourcePath) {
    return { tags: [], summary: '' };
  }

  const html = await readFile(asset.sourcePath, 'utf8');
  const profile =
    extractEmbeddedHtmlProfile(html) ??
    buildHtmlProfile(html, {
      sourcePath: asset.sourcePath,
      sourceHash: asset.sourceHash ?? '',
    });

  return {
    title: profile.title,
    tags: profile.tags,
    summary: profile.aiContext.summary,
  };
}

function stringFrontmatterValue(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function stringArrayFrontmatterValue(value: string | string[] | undefined): string[] {
  return Array.isArray(value) ? value : [];
}

async function enrichMarkdownAsset(asset: BridgeVaultAsset, vaultDir: string): Promise<{
  title?: string;
  tags: string[];
  summary: string;
}> {
  if (asset.kind !== 'markdown-note' || !asset.sourcePath) {
    return { tags: [], summary: '' };
  }

  const converted = await convertMarkdownFileToHtml({
    rootDir: vaultDir,
    markdownPath: asset.sourcePath,
    templateId: 'technical-doc',
  });

  return {
    title: stringFrontmatterValue(converted.frontmatter.title),
    tags: stringArrayFrontmatterValue(converted.frontmatter.tags),
    summary: stringFrontmatterValue(converted.frontmatter.summary) ?? '',
  };
}

async function enrichAsset(asset: BridgeVaultAsset, vaultDir: string): Promise<{
  title?: string;
  tags: string[];
  summary: string;
}> {
  if (asset.kind === 'markdown-note') {
    return enrichMarkdownAsset(asset, vaultDir);
  }

  return enrichHtmlAsset(asset);
}

async function itemFromAsset(vaultDir: string, asset: BridgeVaultAsset): Promise<VaultLibraryItem> {
  const enriched = await enrichAsset(asset, vaultDir);
  const relativePath = relativeSourcePath(vaultDir, asset.sourcePath);
  const folderPath = folderFor(relativePath);
  const thumbnailPath = path.join(vaultDir, '.htmlvault', 'thumbnails', `${asset.id}.png`);

  return {
    id: asset.id,
    kind: asset.kind,
    title: enriched.title || asset.title,
    source: asset.source,
    sourceAgent: asset.sourceAgent,
    sourcePath: asset.sourcePath,
    relativeSourcePath: relativePath,
    folderPath,
    tags: mergeTags(asset.tags, enriched.tags),
    summary: enriched.summary,
    updatedAt: asset.updatedAt,
    thumbnail: {
      status: (await pathExists(thumbnailPath)) ? 'ready' : 'pending',
      path: thumbnailPath,
    },
  };
}

function matchesQuery(item: VaultLibraryItem, query?: string): boolean {
  if (!query?.trim()) {
    return true;
  }

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
  const haystack = [item.title, item.summary, item.relativeSourcePath, item.sourceAgent, ...item.tags]
    .join(' ')
    .toLowerCase();

  return terms.every((term) => haystack.includes(term));
}

function includesAll(values: string[], required?: string[]): boolean {
  if (!required?.length) {
    return true;
  }

  const normalized = new Set(values.map((value) => value.toLowerCase()));
  return required.every((value) => normalized.has(value.toLowerCase()));
}

function includesAny<T extends string>(value: T | undefined, allowed?: T[]): boolean {
  return !allowed?.length || (value !== undefined && allowed.includes(value));
}

function filterItems(items: VaultLibraryItem[], options: BuildVaultLibraryOptions): VaultLibraryItem[] {
  return items.filter(
    (item) =>
      matchesQuery(item, options.query) &&
      includesAll(item.tags, options.tags) &&
      includesAny(item.sourceAgent, options.sourceAgents) &&
      includesAny(item.kind, options.kinds) &&
      includesAny(item.folderPath, options.folders),
  );
}

function summarizeFolders(items: VaultLibraryItem[]): VaultFolderSummary[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    if (!item.folderPath) {
      continue;
    }

    counts.set(item.folderPath, (counts.get(item.folderPath) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([folderPath, itemCount]) => ({ path: folderPath, itemCount }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export async function buildVaultLibrary(options: BuildVaultLibraryOptions): Promise<VaultLibrary> {
  const manifest = await readVaultManifest(options.vaultDir);
  const allItems = await Promise.all(manifest.assets.map((asset) => itemFromAsset(options.vaultDir, asset)));
  const filteredItems = filterItems(allItems, options).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return {
    items: filteredItems,
    folders: summarizeFolders(filteredItems),
    availableFilters: {
      tags: uniqueSorted(allItems.flatMap((item) => item.tags)),
      sourceAgents: uniqueSorted(allItems.flatMap((item) => (item.sourceAgent ? [item.sourceAgent] : []))),
      kinds: Array.from(new Set(allItems.map((item) => item.kind))).sort(),
    },
  };
}
