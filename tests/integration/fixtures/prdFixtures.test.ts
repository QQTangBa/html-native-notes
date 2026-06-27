// @vitest-environment node

import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, readFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { convertMarkdownFileToHtml, scanMarkdownFolder } from '../../../bridge/markdown/importer';
import { intakeBridgeRequestToVault } from '../../../bridge/vault/intake';
import { buildVaultLibrary } from '../../../bridge/vault/library';

interface FixtureSummary {
  mixed: {
    total: number;
    html: number;
    markdown: number;
    projects: number;
    importableHtmlPaths: string[];
  };
  markdown: {
    total: number;
    rootDir: string;
  };
}

let tempDir: string;
let fixturesDir: string;
let vaultDir: string;

const execFile = promisify(execFileCallback);

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), 'html-native-prd-fixtures-'));
  vaultDir = path.join(tempDir, 'vault');
  fixturesDir = path.join(vaultDir, 'imports-fixtures');
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function sha256(filePath: string): Promise<string> {
  return `sha256:${createHash('sha256').update(await readFile(filePath)).digest('hex')}`;
}

async function countFiles(rootDir: string): Promise<number> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const counts = await Promise.all(
    entries.map((entry) => {
      const absolutePath = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        return countFiles(absolutePath);
      }
      return Promise.resolve(entry.isFile() ? 1 : 0);
    }),
  );

  return counts.reduce((sum, count) => sum + count, 0);
}

async function generateFixtures(): Promise<FixtureSummary> {
  const { stdout } = await execFile('node', ['scripts/generate-prd-fixtures.mjs', '--out', fixturesDir], {
    cwd: process.cwd(),
  });
  return JSON.parse(stdout) as FixtureSummary;
}

describe('PRD fixture-scale import foundation', () => {
  it('generates deterministic 100 mixed fixtures and 30 Markdown migration fixtures', async () => {
    const summary = await generateFixtures();

    expect(summary.mixed).toMatchObject({
      total: 100,
      html: 60,
      markdown: 30,
      projects: 10,
    });
    expect(summary.mixed.importableHtmlPaths).toHaveLength(70);
    expect(summary.markdown.total).toBe(30);

    const markdownEntries = await scanMarkdownFolder(summary.markdown.rootDir);

    expect(await countFiles(path.join(fixturesDir, 'mixed100'))).toBe(100);
    expect(markdownEntries).toHaveLength(30);
  });

  it('converts the 30 Markdown fixtures without mutating source notes', async () => {
    const summary = await generateFixtures();
    const notes = await scanMarkdownFolder(summary.markdown.rootDir);
    const hashesBefore = new Map(await Promise.all(notes.map(async (note) => [note.absolutePath, await sha256(note.absolutePath)] as const)));

    const converted = await Promise.all(
      notes.map((note) =>
        convertMarkdownFileToHtml({
          rootDir: summary.markdown.rootDir,
          markdownPath: note.absolutePath,
          templateId: 'research-report',
        }),
      ),
    );

    expect(converted).toHaveLength(30);
    expect(converted.every((item) => Array.isArray(item.frontmatter.tags))).toBe(true);
    expect(converted.flatMap((item) => item.wikilinks).length).toBeGreaterThanOrEqual(30);
    expect(converted.flatMap((item) => item.images)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          alt: 'Evidence chart 0',
          src: './assets/chart-0.png',
        }),
      ]),
    );
    expect(converted.map((item) => item.html).join('\n')).toContain('<pre><code class="language-ts">');

    for (const note of notes) {
      await expect(sha256(note.absolutePath)).resolves.toBe(hashesBefore.get(note.absolutePath));
    }
  });

  it('registers all importable mixed HTML fixtures into the Vault library with source hashes preserved', async () => {
    const summary = await generateFixtures();

    for (const [index, sourcePath] of summary.mixed.importableHtmlPaths.entries()) {
      await intakeBridgeRequestToVault({
        vaultDir,
        request: {
          type: 'registerHtmlAsset',
          requestId: `fixture_${index}`,
          sourcePath,
          sourceHash: await sha256(sourcePath),
          title: `Fixture ${index}`,
          tags: ['fixture-scale'],
          sourceAgent: 'prd-fixture-generator',
          createdAt: '2026-06-27T00:00:00.000Z',
        },
      });
    }

    const library = await buildVaultLibrary({
      vaultDir,
      query: 'fixture-scale',
      tags: ['fixture-scale'],
      sourceAgents: ['prd-fixture-generator'],
    });

    expect(library.items).toHaveLength(70);
    expect(library.folders.map((folder) => folder.path)).toEqual(
      expect.arrayContaining(['imports-fixtures/mixed100/html', 'imports-fixtures/mixed100/projects/project-00']),
    );
    expect(library.items.every((item) => item.thumbnail.status === 'pending')).toBe(true);
  });
});
