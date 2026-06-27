#!/usr/bin/env node

import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

function getOutDir(argv) {
  const outIndex = argv.indexOf('--out');
  if (outIndex !== -1 && argv[outIndex + 1]) {
    return path.resolve(argv[outIndex + 1]);
  }

  return path.resolve('test-fixtures');
}

function htmlDocument(index, titlePrefix = 'Fixture Scale HTML') {
  const title = `${titlePrefix} ${String(index).padStart(2, '0')}`;
  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '  <meta charset="utf-8">',
    `  <title>${title}</title>`,
    '  <meta name="description" content="fixture-scale deterministic PRD import sample">',
    '</head>',
    '<body>',
    '  <article data-tags="fixture-scale,ai-agent">',
    `    <h1>${title}</h1>`,
    '    <p>fixture-scale generated HTML for Vault import, search, preview, and source hash checks.</p>',
    `    <p>Stable index: ${index}</p>`,
    '  </article>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function markdownDocument(index, titlePrefix = 'Fixture Scale Markdown') {
  const padded = String(index).padStart(2, '0');
  return [
    '---',
    `title: ${titlePrefix} ${padded}`,
    `tags: [fixture-scale, note-${index % 5}]`,
    'summary: Deterministic PRD Markdown migration sample',
    '---',
    `# ${titlePrefix} ${padded}`,
    '',
    `This note links to [[Fixture Scale Markdown ${String((index + 1) % 30).padStart(2, '0')}]] for backlink checks.`,
    '',
    `![Evidence chart ${index}](./assets/chart-${index}.png)`,
    '',
    '```ts',
    `const fixtureIndex = ${index};`,
    '```',
    '',
  ].join('\n');
}

async function writeText(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

async function generatePrdFixtures(outDir) {
  const mixedDir = path.join(outDir, 'mixed100');
  const mixedHtmlDir = path.join(mixedDir, 'html');
  const mixedMarkdownDir = path.join(mixedDir, 'markdown');
  const mixedProjectsDir = path.join(mixedDir, 'projects');
  const markdownRootDir = path.join(outDir, 'markdown30');
  const importableHtmlPaths = [];

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  for (let index = 0; index < 60; index += 1) {
    const filePath = path.join(mixedHtmlDir, `report-${String(index).padStart(2, '0')}.html`);
    await writeText(filePath, htmlDocument(index));
    importableHtmlPaths.push(filePath);
  }

  for (let index = 0; index < 30; index += 1) {
    await writeText(path.join(mixedMarkdownDir, `note-${String(index).padStart(2, '0')}.md`), markdownDocument(index, 'Mixed Markdown'));
  }

  for (let index = 0; index < 10; index += 1) {
    const filePath = path.join(mixedProjectsDir, `project-${String(index).padStart(2, '0')}`, 'index.html');
    await writeText(filePath, htmlDocument(index, 'Fixture Scale Project'));
    importableHtmlPaths.push(filePath);
  }

  for (let index = 0; index < 30; index += 1) {
    const folder = path.join(markdownRootDir, `cluster-${index % 3}`);
    await writeText(path.join(folder, 'assets', `chart-${index}.png`), `chart-${index}\n`);
    await writeText(path.join(folder, `note-${String(index).padStart(2, '0')}.md`), markdownDocument(index));
  }

  return {
    mixed: {
      total: 100,
      html: 60,
      markdown: 30,
      projects: 10,
      rootDir: mixedDir,
      importableHtmlPaths,
    },
    markdown: {
      total: 30,
      rootDir: markdownRootDir,
    },
  };
}

const outDir = getOutDir(process.argv.slice(2));
const summary = await generatePrdFixtures(outDir);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
