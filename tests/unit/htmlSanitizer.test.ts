import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from '../../src/server/security/htmlSanitizer';

describe('sanitizeHtml', () => {
  it('removes script tags and inline event handlers', () => {
    const result = sanitizeHtml('<h1 onclick="alert(1)">Hi</h1><script>window.evil = true</script>');

    expect(result).toContain('<h1>Hi</h1>');
    expect(result).not.toContain('script');
    expect(result).not.toContain('onclick');
  });

  it('preserves safe document structure and inline style', () => {
    const result = sanitizeHtml('<article style="color: red"><h2>Title</h2><p data-note="x">Body</p></article>');

    expect(result).toContain('<article style="color: red">');
    expect(result).toContain('<h2>Title</h2>');
    expect(result).toContain('data-note="x"');
  });
});
