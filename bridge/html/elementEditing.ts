import type { AiActionRequest } from '../../src/shared/types';

export interface EditableHtmlElement {
  selector: string;
  tagName: string;
  label: string;
  text: string;
}

export interface ScopedAiEditInput {
  html: string;
  selector: string;
  instruction: string;
  language?: string;
}

const editableSelector = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'li',
  'blockquote',
  'figcaption',
  'button',
  'a',
  'td',
  'th',
].join(',');

function parseHtml(html: string): Document {
  if (typeof DOMParser === 'undefined') {
    throw new Error('HTML element editing requires a DOMParser-capable environment');
  }

  return new DOMParser().parseFromString(html, 'text/html');
}

function nthOfType(element: Element): number {
  let index = 1;
  let sibling = element.previousElementSibling;

  while (sibling) {
    if (sibling.tagName === element.tagName) {
      index += 1;
    }
    sibling = sibling.previousElementSibling;
  }

  return index;
}

function selectorFor(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current.tagName.toLowerCase() !== 'body') {
    parts.unshift(`${current.tagName.toLowerCase()}:nth-of-type(${nthOfType(current)})`);
    current = current.parentElement;
  }

  return parts
    .map((part, index) => {
      if (index > 0) {
        return part;
      }

      return part.replace(':nth-of-type(1)', '');
    })
    .join(' > ');
}

function readableText(element: Element): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function labelFor(tagName: string, text: string): string {
  const preview = text.length > 72 ? `${text.slice(0, 69)}...` : text;
  return `${tagName} ${preview}`;
}

export function listEditableHtmlElements(html: string): EditableHtmlElement[] {
  const document = parseHtml(html);

  return Array.from(document.body.querySelectorAll(editableSelector))
    .map((element) => {
      const tagName = element.tagName.toLowerCase();
      const text = readableText(element);

      return {
        selector: selectorFor(element),
        tagName,
        label: labelFor(tagName, text),
        text,
      };
    })
    .filter((element) => element.text.length > 0);
}

export function applyElementTextEdit(html: string, selector: string, text: string): string {
  const document = parseHtml(html);
  const element = document.body.querySelector(selector);

  if (!element) {
    throw new Error(`Editable HTML element not found: ${selector}`);
  }

  element.textContent = text;
  return document.body.innerHTML;
}

export function buildScopedAiEditRequest(input: ScopedAiEditInput): AiActionRequest {
  const document = parseHtml(input.html);
  const element = document.body.querySelector(input.selector);

  if (!element) {
    throw new Error(`Editable HTML element not found: ${input.selector}`);
  }

  const text = readableText(element);

  return {
    action: 'rewrite',
    language: input.language,
    content: [
      '只修改 selection 指向的元素，保持其他 HTML 结构和内容不变。',
      `用户指令: ${input.instruction}`,
      `当前元素 HTML: ${element.outerHTML}`,
    ].join('\n'),
    selection: [`selector: ${input.selector}`, `tag: ${element.tagName.toLowerCase()}`, `text: ${text}`].join('\n'),
  };
}
