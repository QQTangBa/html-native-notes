import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

type AssetKind = 'image' | 'script' | 'stylesheet' | 'link';

export interface MissingAsset {
  kind: AssetKind;
  reference: string;
  resolvedPath: string;
}

export interface ExternalResource {
  kind: AssetKind;
  reference: string;
}

export interface DangerousScript {
  kind: 'inline-script';
  reason: string;
}

export interface UnpublishableResource {
  kind: AssetKind;
  reference: string;
  reason: string;
}

export interface AssetIntegrityReport {
  htmlPath: string;
  sourceHash: string;
  missingAssets: MissingAsset[];
  externalResources: ExternalResource[];
  dangerousScripts: DangerousScript[];
  unpublishableResources: UnpublishableResource[];
  safeModeRequired: boolean;
}

interface Reference {
  kind: AssetKind;
  value: string;
}

function sha256(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

function isExternal(reference: string): boolean {
  return /^https?:\/\//i.test(reference);
}

function isUnpublishable(reference: string): boolean {
  return /^file:\/\//i.test(reference);
}

function resolveLocal(htmlPath: string, reference: string): string {
  return path.resolve(path.dirname(htmlPath), reference.split('#')[0]?.split('?')[0] ?? reference);
}

function collectReferences(html: string): Reference[] {
  const references: Reference[] = [];
  const addMatches = (pattern: RegExp, kind: AssetKind) => {
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(html))) {
      const value = match[1]?.trim();
      if (value) {
        references.push({ kind, value });
      }
    }
  };

  addMatches(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi, 'image');
  addMatches(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi, 'script');
  addMatches(/<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>/gi, 'stylesheet');
  addMatches(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi, 'link');

  return references;
}

function collectDangerousScripts(html: string): DangerousScript[] {
  const inlineScripts = html.match(/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi) ?? [];

  return inlineScripts.map(() => ({
    kind: 'inline-script',
    reason: 'Inline script execution is unsafe in static safe mode',
  }));
}

export async function scanHtmlAssetIntegrity(options: { htmlPath: string }): Promise<AssetIntegrityReport> {
  const html = await readFile(options.htmlPath, 'utf8');
  const missingAssets: MissingAsset[] = [];
  const externalResources: ExternalResource[] = [];
  const unpublishableResources: UnpublishableResource[] = [];

  for (const reference of collectReferences(html)) {
    if (isUnpublishable(reference.value)) {
      unpublishableResources.push({
        kind: reference.kind,
        reference: reference.value,
        reason: 'file:// resources cannot be published',
      });
      continue;
    }

    if (isExternal(reference.value)) {
      externalResources.push({
        kind: reference.kind,
        reference: reference.value,
      });
      continue;
    }

    if (reference.kind === 'link') {
      continue;
    }

    const resolvedPath = resolveLocal(options.htmlPath, reference.value);
    if (!existsSync(resolvedPath)) {
      missingAssets.push({
        kind: reference.kind,
        reference: reference.value,
        resolvedPath,
      });
    }
  }

  const dangerousScripts = collectDangerousScripts(html);

  return {
    htmlPath: options.htmlPath,
    sourceHash: sha256(html),
    missingAssets,
    externalResources,
    dangerousScripts,
    unpublishableResources,
    safeModeRequired:
      missingAssets.length > 0 ||
      externalResources.length > 0 ||
      dangerousScripts.length > 0 ||
      unpublishableResources.length > 0,
  };
}
