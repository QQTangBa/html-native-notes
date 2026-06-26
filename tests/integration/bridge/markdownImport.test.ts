// @vitest-environment node

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  convertMarkdownFileToHtml,
  listMarkdownTemplates,
  scanMarkdownFolder,
} from '../../../bridge/markdown/importer';

let tempDir: string;
let rootDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), 'html-native-md-import-'));
  rootDir = path.join(tempDir, 'notes');
  await mkdir(path.join(rootDir, 'research', 'assets'), { recursive: true });
  await writeFile(path.join(rootDir, 'research', 'assets', 'chart.png'), 'image', 'utf8');
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('Markdown import and templates', () => {
  it('offers at least three HTML templates for imported Markdown', () => {
    const templates = listMarkdownTemplates();

    expect(templates.map((template) => template.id)).toEqual(
      expect.arrayContaining(['minimal-diary', 'technical-doc', 'research-report']),
    );
    expect(templates.length).toBeGreaterThanOrEqual(3);
  });

  it('scans Markdown folders while preserving relative folder paths', async () => {
    await writeFile(path.join(rootDir, 'daily.md'), '# Daily\n', 'utf8');
    await writeFile(path.join(rootDir, 'research', 'report.md'), '# Report\n', 'utf8');

    const notes = await scanMarkdownFolder(rootDir);

    expect(notes.map((note) => note.relativePath).sort()).toEqual(['daily.md', 'research/report.md']);
  });

  it('converts frontmatter, images, wikilinks, and code blocks into readable HTML', async () => {
    const markdownPath = path.join(rootDir, 'research', 'report.md');
    await writeFile(
      markdownPath,
      [
        '---',
        'title: Gut Market Research',
        'tags: [research, ai]',
        'summary: Imported from Obsidian',
        '---',
        '# Gut Market Research',
        '',
        'See [[daily]] and [[Uncreated Page]].',
        '',
        '![Chart](./assets/chart.png)',
        '',
        '```ts',
        'const score = 42;',
        '```',
      ].join('\n'),
      'utf8',
    );

    const result = await convertMarkdownFileToHtml({
      rootDir,
      markdownPath,
      templateId: 'research-report',
    });

    expect(result.relativePath).toBe('research/report.md');
    expect(result.frontmatter).toEqual({
      title: 'Gut Market Research',
      tags: ['research', 'ai'],
      summary: 'Imported from Obsidian',
    });
    expect(result.wikilinks).toEqual(['daily', 'Uncreated Page']);
    expect(result.images).toEqual([
      {
        alt: 'Chart',
        src: './assets/chart.png',
        resolvedPath: path.join(rootDir, 'research', 'assets', 'chart.png'),
      },
    ]);
    expect(result.html).toContain('<article class="markdown-import template-research-report">');
    expect(result.html).toContain('<h1>Gut Market Research</h1>');
    expect(result.html).toContain('<a data-wikilink="daily" href="daily.html">daily</a>');
    expect(result.html).toContain('<img src="./assets/chart.png" alt="Chart">');
    expect(result.html).toContain('<pre><code class="language-ts">const score = 42;</code></pre>');
  });
});
