// @vitest-environment node

import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scanHtmlAssetIntegrity } from '../../../bridge/assets/scanner';

let tempDir: string;
let htmlPath: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), 'html-native-assets-'));
  htmlPath = path.join(tempDir, 'page.html');
  await mkdir(path.join(tempDir, 'assets'), { recursive: true });
  await writeFile(path.join(tempDir, 'assets', 'ok.png'), 'image-bytes', 'utf8');
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function sha256(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

describe('HTML asset integrity scanner', () => {
  it('reports missing images, external scripts, external stylesheets, dangerous inline script, and unpublishable resources', async () => {
    await writeFile(
      htmlPath,
      [
        '<!doctype html>',
        '<html>',
        '<head>',
        '  <link rel="stylesheet" href="https://cdn.example.com/theme.css">',
        '  <script src="https://cdn.example.com/app.js"></script>',
        '  <script>fetch("https://evil.example.com");</script>',
        '</head>',
        '<body>',
        '  <img src="./assets/ok.png" alt="ok">',
        '  <img src="./assets/missing.png" alt="missing">',
        '  <img src="file:///Users/example/private.png" alt="private">',
        '  <a href="http://example.com">external link</a>',
        '</body>',
        '</html>',
      ].join('\n'),
      'utf8',
    );

    const beforeHash = await sha256(htmlPath);
    const report = await scanHtmlAssetIntegrity({ htmlPath });
    const afterHash = await sha256(htmlPath);

    expect(afterHash).toBe(beforeHash);
    expect(report.sourceHash).toBe(beforeHash);
    expect(report.missingAssets).toEqual([
      {
        kind: 'image',
        reference: './assets/missing.png',
        resolvedPath: path.join(tempDir, 'assets', 'missing.png'),
      },
    ]);
    expect(report.externalResources).toEqual(
      expect.arrayContaining([
        { kind: 'stylesheet', reference: 'https://cdn.example.com/theme.css' },
        { kind: 'script', reference: 'https://cdn.example.com/app.js' },
        { kind: 'link', reference: 'http://example.com' },
      ]),
    );
    expect(report.dangerousScripts).toEqual([
      {
        kind: 'inline-script',
        reason: 'Inline script execution is unsafe in static safe mode',
      },
    ]);
    expect(report.unpublishableResources).toEqual([
      {
        kind: 'image',
        reference: 'file:///Users/example/private.png',
        reason: 'file:// resources cannot be published',
      },
    ]);
    expect(report.safeModeRequired).toBe(true);
  });

  it('passes local complete assets without requiring safe mode', async () => {
    await writeFile(
      htmlPath,
      '<!doctype html><link rel="stylesheet" href="./assets/site.css"><img src="./assets/ok.png">',
      'utf8',
    );
    await writeFile(path.join(tempDir, 'assets', 'site.css'), 'body { color: black; }', 'utf8');

    const report = await scanHtmlAssetIntegrity({ htmlPath });

    expect(report.missingAssets).toEqual([]);
    expect(report.externalResources).toEqual([]);
    expect(report.dangerousScripts).toEqual([]);
    expect(report.unpublishableResources).toEqual([]);
    expect(report.safeModeRequired).toBe(false);
  });
});
