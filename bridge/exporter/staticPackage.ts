import { createHash } from 'node:crypto';
import { copyFile, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readVaultAssetSource } from '../vault/source';

type ExportAssetKind = 'image' | 'script' | 'stylesheet';

export interface CopiedExportAsset {
  kind: ExportAssetKind;
  reference: string;
  outputPath: string;
}

export interface SkippedExportResource {
  kind: ExportAssetKind;
  reference: string;
}

export interface StaticPackageExportResult {
  assetId: string;
  exportType: 'static-package';
  outputDir: string;
  indexPath: string;
  manifestPath: string;
  copiedAssets: CopiedExportAsset[];
  skippedExternal: SkippedExportResource[];
  sourceHash: string;
}

export interface MarkdownExportResult {
  assetId: string;
  exportType: 'markdown';
  outputPath: string;
  sourceHash: string;
}

interface HtmlReference {
  kind: ExportAssetKind;
  reference: string;
}

function sha256(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

function safeFileName(value: string, fallback: string): string {
  const cleaned = Array.from(value)
    .map((char) => (char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char) ? '-' : char))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

function stripReferenceSuffix(reference: string): string {
  return reference.split('#')[0]?.split('?')[0] ?? reference;
}

function isExternal(reference: string): boolean {
  return /^(?:https?:)?\/\//i.test(reference) || /^data:/i.test(reference) || /^file:\/\//i.test(reference);
}

function collectReferences(html: string): HtmlReference[] {
  const references: HtmlReference[] = [];
  const addMatches = (pattern: RegExp, kind: ExportAssetKind) => {
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(html))) {
      const reference = match[1]?.trim();
      if (reference) {
        references.push({ kind, reference });
      }
    }
  };

  addMatches(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi, 'image');
  addMatches(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi, 'script');
  addMatches(/<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>/gi, 'stylesheet');

  return references;
}

function isInside(parentPath: string, childPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return Boolean(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

async function copyLocalReference(options: {
  sourceDir: string;
  outputDir: string;
  reference: HtmlReference;
}): Promise<CopiedExportAsset | undefined> {
  const cleanReference = stripReferenceSuffix(options.reference.reference);
  if (!cleanReference || path.isAbsolute(cleanReference) || isExternal(cleanReference)) {
    return undefined;
  }

  const sourcePath = path.resolve(options.sourceDir, cleanReference);
  if (!isInside(options.sourceDir, sourcePath)) {
    return undefined;
  }

  try {
    const sourceStat = await stat(sourcePath);
    if (!sourceStat.isFile()) {
      return undefined;
    }
  } catch {
    return undefined;
  }

  const outputPath = path.join(options.outputDir, cleanReference);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await copyFile(sourcePath, outputPath);

  return {
    kind: options.reference.kind,
    reference: options.reference.reference,
    outputPath,
  };
}

function htmlToMarkdown(html: string, title: string): string {
  const body = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<\/h1>/gi, '\n\n')
    .replace(/<h1\b[^>]*>/gi, '# ')
    .replace(/<\/h2>/gi, '\n\n')
    .replace(/<h2\b[^>]*>/gi, '## ')
    .replace(/<\/h3>/gi, '\n\n')
    .replace(/<h3\b[^>]*>/gi, '### ')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return body.startsWith('# ') ? `${body}\n` : `# ${title}\n\n${body}\n`;
}

export async function exportVaultAssetStaticPackage(options: {
  vaultDir: string;
  assetId: string;
}): Promise<StaticPackageExportResult> {
  const source = await readVaultAssetSource(options);
  const sourceHash = sha256(source.html);
  const outputDir = path.join(options.vaultDir, '.htmlvault', 'exports', source.assetId, 'latest');
  const indexPath = path.join(outputDir, 'index.html');
  const manifestPath = path.join(outputDir, 'manifest.json');
  const sourceDir = path.dirname(source.sourcePath);

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await writeFile(indexPath, source.html, 'utf8');

  const copiedAssets: CopiedExportAsset[] = [];
  const skippedExternal: SkippedExportResource[] = [];

  for (const reference of collectReferences(source.html)) {
    if (isExternal(reference.reference)) {
      skippedExternal.push(reference);
      continue;
    }

    const copied = await copyLocalReference({ sourceDir, outputDir, reference });
    if (copied) {
      copiedAssets.push(copied);
    }
  }

  const result: StaticPackageExportResult = {
    assetId: source.assetId,
    exportType: 'static-package',
    outputDir,
    indexPath,
    manifestPath,
    copiedAssets,
    skippedExternal,
    sourceHash,
  };

  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        ...result,
        title: source.title,
        sourcePath: source.sourcePath,
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    'utf8',
  );

  return result;
}

export async function exportVaultAssetMarkdown(options: {
  vaultDir: string;
  assetId: string;
}): Promise<MarkdownExportResult> {
  const source = await readVaultAssetSource(options);
  const outputDir = path.join(options.vaultDir, '.htmlvault', 'exports', source.assetId);
  const outputPath = path.join(outputDir, `${safeFileName(source.title, source.assetId)}.md`);
  const markdown = htmlToMarkdown(source.html, source.title);

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, markdown, 'utf8');

  return {
    assetId: source.assetId,
    exportType: 'markdown',
    outputPath,
    sourceHash: sha256(source.html),
  };
}
