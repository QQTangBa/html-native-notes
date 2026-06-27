import { createHash } from 'node:crypto';
import { access, mkdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { convertMarkdownFileToHtml } from '../markdown/importer';
import { intakeBridgeRequestToVault, readVaultManifest, type BridgeVaultAsset } from './intake';
import { buildVaultLibrary, type VaultLibraryItem } from './library';

export interface ConvertMarkdownAssetToHtmlOptions {
  vaultDir: string;
  assetId: string;
  templateId?: string;
}

export interface MarkdownHtmlConversionResult {
  markdownAssetId: string;
  outputPath: string;
  asset: VaultLibraryItem;
}

function httpError(message: string, statusCode: number): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}

function normalizeRelative(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

function isInside(parentPath: string, childPath: string, allowEqual = false): boolean {
  const relative = path.relative(parentPath, childPath);
  return (allowEqual && relative === '') || Boolean(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

async function assertSourceInsideVault(vaultDir: string, sourcePath: string): Promise<void> {
  const [vaultRealPath, sourceRealPath] = await Promise.all([realpath(vaultDir), realpath(sourcePath)]);

  if (!isInside(vaultRealPath, sourceRealPath)) {
    throw httpError('Markdown conversion source must stay inside the configured Vault', 400);
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function uniqueHtmlOutputPath(markdownPath: string): Promise<string> {
  const parsed = path.parse(markdownPath);
  const stem = parsed.name;
  const first = path.join(parsed.dir, `${stem}.html`);

  if (!(await pathExists(first))) {
    return first;
  }

  let suffix = 1;
  while (true) {
    const candidate = path.join(parsed.dir, `${stem}-${suffix}.html`);
    if (!(await pathExists(candidate))) {
      return candidate;
    }
    suffix += 1;
  }
}

function sha256(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function stringFrontmatterValue(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function stringArrayFrontmatterValue(value: string | string[] | undefined): string[] {
  return Array.isArray(value) ? value : [];
}

function mergeTags(...groups: Array<Array<string | undefined>>): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const tag of groups.flat()) {
    const normalized = tag?.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    merged.push(normalized);
  }

  return merged;
}

function htmlDocument(options: { title: string; summary: string; tags: string[]; body: string }): string {
  const keywords = options.tags.join(', ');

  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <title>${escapeHtml(options.title)}</title>`,
    options.summary ? `  <meta name="description" content="${escapeHtml(options.summary)}">` : '',
    keywords ? `  <meta name="keywords" content="${escapeHtml(keywords)}">` : '',
    '</head>',
    '<body>',
    options.body,
    '</body>',
    '</html>',
  ]
    .filter(Boolean)
    .join('\n');
}

function markdownAssetById(assets: BridgeVaultAsset[], assetId: string): BridgeVaultAsset & { kind: 'markdown-note'; sourcePath: string } {
  const asset = assets.find((item) => item.id === assetId);
  if (!asset) {
    throw httpError(`Vault asset not found: ${assetId}`, 404);
  }
  if (asset.kind !== 'markdown-note' || !asset.sourcePath) {
    throw httpError(`Vault asset is not a Markdown note: ${assetId}`, 400);
  }

  return asset as BridgeVaultAsset & { kind: 'markdown-note'; sourcePath: string };
}

export async function convertMarkdownAssetToHtml(options: ConvertMarkdownAssetToHtmlOptions): Promise<MarkdownHtmlConversionResult> {
  const manifest = await readVaultManifest(options.vaultDir);
  const markdownAsset = markdownAssetById(manifest.assets, options.assetId);

  await assertSourceInsideVault(options.vaultDir, markdownAsset.sourcePath);

  const converted = await convertMarkdownFileToHtml({
    rootDir: options.vaultDir,
    markdownPath: markdownAsset.sourcePath,
    templateId: options.templateId ?? 'technical-doc',
  });
  const title = stringFrontmatterValue(converted.frontmatter.title) ?? markdownAsset.title;
  const summary = stringFrontmatterValue(converted.frontmatter.summary) ?? '';
  const tags = mergeTags(markdownAsset.tags, stringArrayFrontmatterValue(converted.frontmatter.tags), converted.wikilinks, ['markdown-converted']);
  const html = htmlDocument({
    title,
    summary,
    tags,
    body: converted.html,
  });
  const outputPath = await uniqueHtmlOutputPath(markdownAsset.sourcePath);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html, 'utf8');

  const intake = await intakeBridgeRequestToVault({
    vaultDir: options.vaultDir,
    request: {
      requestId: `convert_${markdownAsset.id}_${createHash('sha256').update(outputPath).digest('hex').slice(0, 8)}`,
      type: 'registerHtmlAsset',
      createdAt: new Date().toISOString(),
      sourceAgent: markdownAsset.sourceAgent,
      sourcePath: outputPath,
      sourceHash: sha256(html),
      title,
      tags,
    },
  });
  const library = await buildVaultLibrary({ vaultDir: options.vaultDir });
  const item = library.items.find((candidate) => candidate.id === intake.asset.id);

  if (!item) {
    throw httpError(`Converted HTML asset was not indexed: ${normalizeRelative(path.relative(options.vaultDir, outputPath))}`, 500);
  }

  return {
    markdownAssetId: markdownAsset.id,
    outputPath,
    asset: item,
  };
}
