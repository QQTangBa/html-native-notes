import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export interface MarkdownTemplate {
  id: string;
  label: string;
  className: string;
}

export interface MarkdownScanResult {
  absolutePath: string;
  relativePath: string;
}

export interface MarkdownImage {
  alt: string;
  src: string;
  resolvedPath: string;
}

export interface MarkdownConversionResult {
  relativePath: string;
  frontmatter: Record<string, string | string[]>;
  wikilinks: string[];
  images: MarkdownImage[];
  html: string;
}

const templates: MarkdownTemplate[] = [
  { id: 'minimal-diary', label: 'Minimal Diary', className: 'template-minimal-diary' },
  { id: 'technical-doc', label: 'Technical Doc', className: 'template-technical-doc' },
  { id: 'research-report', label: 'Research Report', className: 'template-research-report' },
];

export function listMarkdownTemplates(): MarkdownTemplate[] {
  return templates;
}

function normalizeRelative(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

async function walkMarkdown(rootDir: string, currentDir = rootDir): Promise<MarkdownScanResult[]> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const results: MarkdownScanResult[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      results.push(...(await walkMarkdown(rootDir, absolutePath)));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      results.push({
        absolutePath,
        relativePath: normalizeRelative(path.relative(rootDir, absolutePath)),
      });
    }
  }

  return results;
}

export async function scanMarkdownFolder(rootDir: string): Promise<MarkdownScanResult[]> {
  return walkMarkdown(rootDir);
}

function parseFrontmatter(markdown: string): { frontmatter: Record<string, string | string[]>; body: string } {
  if (!markdown.startsWith('---\n')) {
    return { frontmatter: {}, body: markdown };
  }

  const end = markdown.indexOf('\n---', 4);
  if (end === -1) {
    return { frontmatter: {}, body: markdown };
  }

  const raw = markdown.slice(4, end).trim();
  const frontmatter: Record<string, string | string[]> = {};

  for (const line of raw.split('\n')) {
    const [key, ...rest] = line.split(':');
    if (!key || rest.length === 0) {
      continue;
    }

    const value = rest.join(':').trim();
    const arrayMatch = /^\[(.*)]$/.exec(value);
    frontmatter[key.trim()] = arrayMatch
      ? arrayMatch[1]
          ?.split(',')
          .map((item) => item.trim())
          .filter(Boolean) ?? []
      : value;
  }

  return {
    frontmatter,
    body: markdown.slice(end + '\n---'.length).trimStart(),
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function wikilinkHref(value: string): string {
  return `${value.trim().replace(/\s+/g, '-').toLowerCase()}.html`;
}

function convertInline(markdown: string, wikilinks: string[], images: MarkdownImage[], markdownDir: string): string {
  return escapeHtml(markdown)
    .replace(/!\[([^\]]*)]\(([^)]+)\)/g, (_match, alt: string, src: string) => {
      images.push({
        alt,
        src,
        resolvedPath: path.resolve(markdownDir, src),
      });
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`;
    })
    .replace(/\[\[([^\]]+)]]/g, (_match, target: string) => {
      wikilinks.push(target);
      return `<a data-wikilink="${escapeHtml(target)}" href="${escapeHtml(wikilinkHref(target))}">${escapeHtml(target)}</a>`;
    });
}

function markdownBodyToHtml(body: string, markdownDir: string): { html: string; wikilinks: string[]; images: MarkdownImage[] } {
  const wikilinks: string[] = [];
  const images: MarkdownImage[] = [];
  const html: string[] = [];
  const lines = body.split('\n');
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    const fence = /^```(\w+)?\s*$/.exec(line);

    if (fence) {
      const language = fence[1] ?? '';
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index] ?? '')) {
        code.push(lines[index] ?? '');
        index += 1;
      }
      html.push(`<pre><code class="language-${escapeHtml(language)}">${escapeHtml(code.join('\n'))}</code></pre>`);
      index += 1;
      continue;
    }

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1]?.length ?? 1;
      html.push(`<h${level}>${convertInline(heading[2] ?? '', wikilinks, images, markdownDir)}</h${level}>`);
      index += 1;
      continue;
    }

    html.push(`<p>${convertInline(line, wikilinks, images, markdownDir)}</p>`);
    index += 1;
  }

  return { html: html.join('\n'), wikilinks, images };
}

export async function convertMarkdownFileToHtml(options: {
  rootDir: string;
  markdownPath: string;
  templateId: string;
}): Promise<MarkdownConversionResult> {
  const template = templates.find((item) => item.id === options.templateId);
  if (!template) {
    throw new Error(`Unknown Markdown template: ${options.templateId}`);
  }

  const markdown = await readFile(options.markdownPath, 'utf8');
  const parsed = parseFrontmatter(markdown);
  const converted = markdownBodyToHtml(parsed.body, path.dirname(options.markdownPath));

  return {
    relativePath: normalizeRelative(path.relative(options.rootDir, options.markdownPath)),
    frontmatter: parsed.frontmatter,
    wikilinks: converted.wikilinks,
    images: converted.images,
    html: `<article class="markdown-import ${template.className}">\n${converted.html}\n</article>`,
  };
}
