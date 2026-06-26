import { JSDOM } from 'jsdom';

export interface HtmlProfileAsset {
  kind: 'image' | 'stylesheet' | 'script';
  src: string;
  alt?: string;
}

export interface HtmlProfileBlock {
  id: string;
  selector: string;
  text: string;
}

export interface HtmlProfile {
  schemaVersion: 1;
  profileVersion: 1;
  title: string;
  tags: string[];
  source: {
    path: string;
    hash: string;
  };
  assets: HtmlProfileAsset[];
  blocks: HtmlProfileBlock[];
  aiContext: {
    summary: string;
    headings: string[];
  };
  themeVars: Record<string, string>;
}

export interface BuildHtmlProfileOptions {
  sourcePath: string;
  sourceHash: string;
}

interface LegacyHtmlProfile {
  title?: unknown;
  labels?: unknown;
  sourcePath?: unknown;
  sourceHash?: unknown;
}

const profileScriptPattern =
  /<script\b(?=[^>]*\bid=["']ainote-profile["'])(?=[^>]*\btype=["']application\/json["'])[^>]*>[\s\S]*?<\/script>/i;

function textContent(element: Element | null): string {
  return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function splitTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function collectAssets(document: Document): HtmlProfileAsset[] {
  const assets: HtmlProfileAsset[] = [];

  for (const element of Array.from(document.querySelectorAll('link[href], img[src], script[src]'))) {
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'link' && element.getAttribute('rel')?.toLowerCase() === 'stylesheet') {
      assets.push({ kind: 'stylesheet', src: element.getAttribute('href') ?? '' });
      continue;
    }

    if (tagName === 'img') {
      assets.push({
        kind: 'image',
        src: element.getAttribute('src') ?? '',
        alt: element.getAttribute('alt') ?? '',
      });
      continue;
    }

    if (tagName === 'script' && element.getAttribute('src')) {
      assets.push({ kind: 'script', src: element.getAttribute('src') ?? '' });
    }
  }

  return assets;
}

function collectBlocks(document: Document): HtmlProfileBlock[] {
  const tagCounts = new Map<string, number>();
  let generatedCount = 0;

  return Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote')).flatMap((element) => {
    const text = textContent(element);
    if (!text) {
      return [];
    }

    const existingId = element.getAttribute('data-ainote-block-id');
    if (existingId) {
      return [
        {
          id: existingId,
          selector: `[data-ainote-block-id="${existingId}"]`,
          text,
        },
      ];
    }

    generatedCount += 1;
    const tagName = element.tagName.toLowerCase();
    const nextTagCount = (tagCounts.get(tagName) ?? 0) + 1;
    tagCounts.set(tagName, nextTagCount);

    return [
      {
        id: `block-${String(generatedCount).padStart(4, '0')}`,
        selector: `${tagName}:nth-of-type(${nextTagCount})`,
        text,
      },
    ];
  });
}

function collectThemeVars(document: Document): Record<string, string> {
  const vars: Record<string, string> = {};

  for (const style of Array.from(document.querySelectorAll('style'))) {
    const css = style.textContent ?? '';
    for (const match of css.matchAll(/(--[a-zA-Z0-9-_]+)\s*:\s*([^;{}]+);/g)) {
      const name = match[1];
      const value = match[2];
      if (name && value) {
        vars[name] = value.trim();
      }
    }
  }

  return vars;
}

function safeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function buildHtmlProfile(html: string, options: BuildHtmlProfileOptions): HtmlProfile {
  const dom = new JSDOM(html);
  const { document } = dom.window;
  const title = textContent(document.querySelector('title')) || textContent(document.querySelector('h1'));
  const keywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content') ?? '';
  const summary = document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';
  const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((heading) => textContent(heading));

  return {
    schemaVersion: 1,
    profileVersion: 1,
    title,
    tags: splitTags(keywords),
    source: {
      path: options.sourcePath,
      hash: options.sourceHash,
    },
    assets: collectAssets(document),
    blocks: collectBlocks(document),
    aiContext: {
      summary,
      headings: headings.filter(Boolean),
    },
    themeVars: collectThemeVars(document),
  };
}

export function migrateHtmlProfile(value: unknown): HtmlProfile {
  const legacy = (value ?? {}) as LegacyHtmlProfile;

  return {
    schemaVersion: 1,
    profileVersion: 1,
    title: safeString(legacy.title),
    tags: Array.isArray(legacy.labels) ? legacy.labels.filter((item): item is string => typeof item === 'string') : [],
    source: {
      path: safeString(legacy.sourcePath),
      hash: safeString(legacy.sourceHash),
    },
    assets: [],
    blocks: [],
    aiContext: {
      summary: '',
      headings: [],
    },
    themeVars: {},
  };
}

export function extractEmbeddedHtmlProfile(html: string): HtmlProfile | null {
  const dom = new JSDOM(html);
  const script = dom.window.document.querySelector('script#ainote-profile[type="application/json"]');

  if (!script?.textContent) {
    return null;
  }

  const parsed = JSON.parse(script.textContent) as HtmlProfile;
  return parsed.schemaVersion === 1 && parsed.profileVersion === 1 ? parsed : migrateHtmlProfile(parsed);
}

export function embedHtmlProfile(html: string, profile: HtmlProfile): string {
  const json = JSON.stringify(profile, null, 2).replaceAll('</script', '<\\/script');
  const script = `<script type="application/json" id="ainote-profile">${json}</script>`;

  if (profileScriptPattern.test(html)) {
    return html.replace(profileScriptPattern, script);
  }

  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${script}\n</head>`);
  }

  return `${script}\n${html}`;
}
