import { Copy, FilePlus2, Link2, Save, Tags, Trash2 } from 'lucide-react';
import { appCopy, type AppCopy } from '../../shared/i18n';
import type { NoteMeta } from '../../shared/types';

interface NoteLibraryProps {
  notes: NoteMeta[];
  activeNoteId?: string;
  newTitle: string;
  busy: boolean;
  onTitleChange: (title: string) => void;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onSave: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  copy?: AppCopy['notes'];
}

export function NoteLibrary({
  notes,
  activeNoteId,
  newTitle,
  busy,
  onTitleChange,
  onCreate,
  onOpen,
  onSave,
  onDuplicate,
  onDelete,
  copy = appCopy.en.notes,
}: NoteLibraryProps) {
  return (
    <aside className="panel library-panel" aria-label={copy.ariaLabel}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2>{copy.title}</h2>
        </div>
      </div>

      <label className="field-label" htmlFor="note-title">
        {copy.titleLabel}
      </label>
      <div className="create-row">
        <input
          id="note-title"
          value={newTitle}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder={copy.titlePlaceholder}
        />
        <button className="icon-button primary" type="button" onClick={onCreate} disabled={busy} aria-label={copy.create}>
          <FilePlus2 size={18} />
        </button>
      </div>

      <div className="tool-row" aria-label={copy.actions}>
        <button type="button" onClick={onSave} disabled={busy || !activeNoteId} aria-label={copy.save}>
          <Save size={16} />
          {copy.save}
        </button>
        <button type="button" onClick={onDuplicate} disabled={busy || !activeNoteId} aria-label={copy.duplicate}>
          <Copy size={16} />
          {copy.duplicate}
        </button>
        <button type="button" onClick={onDelete} disabled={busy || !activeNoteId} aria-label={copy.delete}>
          <Trash2 size={16} />
          {copy.delete}
        </button>
      </div>

      <nav className="note-list" aria-label={copy.savedNotes}>
        {notes.length === 0 ? (
          <p className="muted">{copy.empty}</p>
        ) : (
          notes.map((note) => (
            <button
              type="button"
              key={note.id}
              className={note.id === activeNoteId ? 'note-item active' : 'note-item'}
              onClick={() => onOpen(note.id)}
            >
              <span>{note.title}</span>
              <time>{new Date(note.updatedAt).toLocaleString()}</time>
              {note.tags.length || note.wikilinks?.length || note.backlinks?.length ? (
                <span className="note-meta-pills">
                  {note.tags.map((tag) => (
                    <span key={`tag-${tag}`} className="note-pill">
                      <Tags size={11} aria-hidden="true" />
                      #{tag}
                    </span>
                  ))}
                  {note.wikilinks?.map((link) => (
                    <span key={`link-${link}`} className="note-pill">
                      <Link2 size={11} aria-hidden="true" />
                      [[{link}]]
                    </span>
                  ))}
                  {note.backlinks?.map((backlink) => (
                    <span key={`backlink-${backlink}`} className="note-pill backlink">
                      backlink: {backlink}
                    </span>
                  ))}
                </span>
              ) : null}
            </button>
          ))
        )}
      </nav>
    </aside>
  );
}
