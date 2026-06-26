import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const purify = createDOMPurify(window);

export function sanitizeHtml(html: string): string {
  return purify.sanitize(html, {
    ADD_ATTR: ['style', 'data-note'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'srcdoc'],
  });
}
