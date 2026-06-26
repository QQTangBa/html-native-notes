import { Copy, FilePlus2, Save, Trash2 } from 'lucide-react';
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
}: NoteLibraryProps) {
  return (
    <aside className="panel library-panel" aria-label="Note library">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Library</p>
          <h2>HTML Notes</h2>
        </div>
      </div>

      <label className="field-label" htmlFor="note-title">
        Note title
      </label>
      <div className="create-row">
        <input
          id="note-title"
          value={newTitle}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="新 HTML 笔记"
        />
        <button className="icon-button primary" type="button" onClick={onCreate} disabled={busy} aria-label="Create note">
          <FilePlus2 size={18} />
        </button>
      </div>

      <div className="tool-row" aria-label="Note actions">
        <button type="button" onClick={onSave} disabled={busy || !activeNoteId} aria-label="Save note">
          <Save size={16} />
          Save
        </button>
        <button type="button" onClick={onDuplicate} disabled={busy || !activeNoteId} aria-label="Duplicate note">
          <Copy size={16} />
          Copy
        </button>
        <button type="button" onClick={onDelete} disabled={busy || !activeNoteId} aria-label="Delete note">
          <Trash2 size={16} />
          Delete
        </button>
      </div>

      <nav className="note-list" aria-label="Saved notes">
        {notes.length === 0 ? (
          <p className="muted">还没有笔记。创建一个 HTML 文件开始。</p>
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
            </button>
          ))
        )}
      </nav>
    </aside>
  );
}
