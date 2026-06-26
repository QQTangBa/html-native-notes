import DOMPurify from 'dompurify';

interface PreviewPaneProps {
  html: string;
}

export function PreviewPane({ html }: PreviewPaneProps) {
  const safeHtml = DOMPurify.sanitize(html, {
    ADD_ATTR: ['style', 'data-note'],
    FORBID_TAGS: ['script', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'srcdoc'],
  });

  return (
    <section className="preview-frame-wrap" aria-label="HTML preview panel">
      <div className="panel-header compact">
        <div>
          <p className="eyebrow">Preview</p>
          <h2>Live Render</h2>
        </div>
      </div>
      <iframe title="HTML preview" sandbox="" srcDoc={safeHtml} />
    </section>
  );
}
