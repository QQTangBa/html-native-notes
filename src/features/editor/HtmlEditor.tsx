interface HtmlEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function HtmlEditor({ value, onChange }: HtmlEditorProps) {
  return (
    <section className="panel editor-panel" aria-label="HTML editor">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Source</p>
          <h2>HTML Source</h2>
        </div>
      </div>
      <label className="sr-only" htmlFor="html-source">
        HTML source
      </label>
      <textarea
        id="html-source"
        className="source-editor"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
      />
    </section>
  );
}
