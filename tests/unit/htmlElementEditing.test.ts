import { describe, expect, it } from 'vitest';
import { applyElementTextEdit, buildScopedAiEditRequest, listEditableHtmlElements } from '../../bridge/html/elementEditing';

describe('HTML element editing', () => {
  it('lists editable rendered elements with stable selectors and readable labels', () => {
    const elements = listEditableHtmlElements('<article><h1>Quarterly Report</h1><p>Original paragraph.</p><button>Keep action</button></article>');

    expect(elements).toEqual([
      {
        selector: 'article > h1:nth-of-type(1)',
        tagName: 'h1',
        label: 'h1 Quarterly Report',
        text: 'Quarterly Report',
      },
      {
        selector: 'article > p:nth-of-type(1)',
        tagName: 'p',
        label: 'p Original paragraph.',
        text: 'Original paragraph.',
      },
      {
        selector: 'article > button:nth-of-type(1)',
        tagName: 'button',
        label: 'button Keep action',
        text: 'Keep action',
      },
    ]);
  });

  it('applies manual edits only to the selected rendered element', () => {
    const html = '<main><h1>Keep title</h1><p>Original paragraph.</p><p>Keep second paragraph.</p></main>';
    const edited = applyElementTextEdit(html, 'main > p:nth-of-type(1)', 'Edited only here.');

    expect(edited).toContain('<h1>Keep title</h1>');
    expect(edited).toContain('<p>Edited only here.</p>');
    expect(edited).toContain('<p>Keep second paragraph.</p>');
    expect(edited).not.toContain('Original paragraph.');
  });

  it('builds a scoped AI edit request anchored to the selected element instead of the whole document', () => {
    const request = buildScopedAiEditRequest({
      html: '<main><h1>Keep title</h1><p>Original paragraph.</p></main>',
      selector: 'main > p:nth-of-type(1)',
      instruction: 'Make the selected paragraph more concise.',
      language: 'zh',
    });

    expect(request.action).toBe('rewrite');
    expect(request.selection).toContain('selector: main > p:nth-of-type(1)');
    expect(request.selection).toContain('text: Original paragraph.');
    expect(request.content).not.toContain('<h1>Keep title</h1>');
    expect(request.content).toContain('只修改 selection 指向的元素');
  });
});
