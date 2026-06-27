export interface HtmlNoteMetadata {
  tags: string[];
  wikilinks: string[];
}

function decodeHtml(value: string): string {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

function uniqueNormalized(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim().replace(/^#/, '');
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function attributeValues(html: string, attributeName: string): string[] {
  const pattern = new RegExp(`\\b${attributeName}=("|')([^"']+)\\1`, 'gi');
  const values: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html))) {
    values.push(decodeHtml(match[2] ?? ''));
  }

  return values;
}

function visibleText(html: string): string {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  );
}

export function extractHtmlNoteMetadata(html: string): HtmlNoteMetadata {
  const wikiLinks = attributeValues(html, 'data-wikilink');
  const explicitTags = attributeValues(html, 'data-tag');
  const inlineTags = Array.from(visibleText(html).matchAll(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu), (match) => match[1] ?? '');

  return {
    tags: uniqueNormalized([...explicitTags, ...inlineTags]),
    wikilinks: uniqueNormalized(wikiLinks),
  };
}
