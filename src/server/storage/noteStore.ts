import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { NoteMeta, NoteRecord } from '../../shared/types';

interface CreateNoteInput {
  title: string;
  content?: string;
  tags?: string[];
}

interface MetadataFile {
  notes: NoteMeta[];
}

const defaultHtml = (title: string) => `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <article>
      <h1>${escapeHtml(title)}</h1>
      <p>开始写你的 HTML 笔记。</p>
    </article>
  </body>
</html>
`;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function slugify(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'note';
}

function assertValidNoteId(id: string): void {
  if (!/^note_[a-z0-9-]+$/i.test(id)) {
    throw new Error(`Invalid note id: ${id}`);
  }
}

export class FileNoteStore {
  private readonly notesDir: string;
  private readonly trashDir: string;
  private readonly metadataPath: string;
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(private readonly dataDir: string) {
    this.notesDir = path.resolve(dataDir, 'notes');
    this.trashDir = path.resolve(dataDir, 'trash');
    this.metadataPath = path.resolve(dataDir, 'metadata.json');
  }

  async init(): Promise<void> {
    await mkdir(this.notesDir, { recursive: true });
    await mkdir(this.trashDir, { recursive: true });

    try {
      await readFile(this.metadataPath, 'utf8');
    } catch {
      await this.writeMetadata({ notes: [] });
    }
  }

  async listNotes(): Promise<NoteMeta[]> {
    const metadata = await this.readMetadata();
    return metadata.notes.filter((note) => !note.archived).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createNote(input: CreateNoteInput): Promise<NoteMeta> {
    return this.withWriteLock(async () => {
      const metadata = await this.readMetadata();
      const now = new Date().toISOString();
      const id = `note_${randomUUID()}`;
      const slug = slugify(input.title);
      const fileName = `${slug}-${id.slice(5, 13)}.html`;
      const note: NoteMeta = {
        id,
        title: input.title.trim() || 'Untitled note',
        slug,
        fileName,
        createdAt: now,
        updatedAt: now,
        tags: input.tags ?? [],
        archived: false,
      };

      await this.writeNoteFile(fileName, input.content ?? defaultHtml(note.title));
      await this.writeMetadata({ notes: [note, ...metadata.notes] });
      return note;
    });
  }

  async getNote(id: string): Promise<NoteRecord> {
    assertValidNoteId(id);
    const note = await this.findActiveNote(id);
    const content = await readFile(this.resolveNoteFile(note.fileName), 'utf8');
    return { ...note, content };
  }

  async saveNoteContent(id: string, content: string): Promise<NoteMeta> {
    assertValidNoteId(id);
    return this.withWriteLock(async () => {
      const metadata = await this.readMetadata();
      const noteIndex = metadata.notes.findIndex((note) => note.id === id && !note.archived);

      if (noteIndex === -1) {
        throw new Error(`Note not found: ${id}`);
      }

      const current = metadata.notes[noteIndex]!;
      const updated: NoteMeta = {
        ...current,
        updatedAt: new Date().toISOString(),
      };

      await this.writeNoteFile(current.fileName, content);
      metadata.notes[noteIndex] = updated;
      await this.writeMetadata(metadata);
      return updated;
    });
  }

  async updateNote(id: string, patch: Partial<Pick<NoteMeta, 'title' | 'tags'>>): Promise<NoteMeta> {
    assertValidNoteId(id);
    return this.withWriteLock(async () => {
      const metadata = await this.readMetadata();
      const noteIndex = metadata.notes.findIndex((note) => note.id === id && !note.archived);

      if (noteIndex === -1) {
        throw new Error(`Note not found: ${id}`);
      }

      const current = metadata.notes[noteIndex]!;
      const updated: NoteMeta = {
        ...current,
        title: patch.title?.trim() || current.title,
        tags: patch.tags ?? current.tags,
        updatedAt: new Date().toISOString(),
      };

      metadata.notes[noteIndex] = updated;
      await this.writeMetadata(metadata);
      return updated;
    });
  }

  async duplicateNote(id: string): Promise<NoteMeta> {
    const source = await this.getNote(id);
    return this.createNote({
      title: `${source.title} copy`,
      content: source.content,
      tags: source.tags,
    });
  }

  async deleteNote(id: string): Promise<void> {
    assertValidNoteId(id);
    await this.withWriteLock(async () => {
      const metadata = await this.readMetadata();
      const noteIndex = metadata.notes.findIndex((note) => note.id === id && !note.archived);

      if (noteIndex === -1) {
        throw new Error(`Note not found: ${id}`);
      }

      const [note] = metadata.notes.splice(noteIndex, 1);
      await rename(this.resolveNoteFile(note!.fileName), this.resolveTrashFile(note!.fileName));
      await this.writeMetadata(metadata);
    });
  }

  private async findActiveNote(id: string): Promise<NoteMeta> {
    const metadata = await this.readMetadata();
    const note = metadata.notes.find((item) => item.id === id && !item.archived);

    if (!note) {
      throw new Error(`Note not found: ${id}`);
    }

    return note;
  }

  private async readMetadata(): Promise<MetadataFile> {
    const raw = await readFile(this.metadataPath, 'utf8');
    const parsed = JSON.parse(raw) as MetadataFile;
    return { notes: Array.isArray(parsed.notes) ? parsed.notes : [] };
  }

  private async writeMetadata(metadata: MetadataFile): Promise<void> {
    await mkdir(path.dirname(this.metadataPath), { recursive: true });
    await this.atomicWrite(this.metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  }

  private async writeNoteFile(fileName: string, content: string): Promise<void> {
    await this.atomicWrite(this.resolveNoteFile(fileName), content);
  }

  private resolveNoteFile(fileName: string): string {
    return this.resolveScopedPath(this.notesDir, fileName);
  }

  private resolveTrashFile(fileName: string): string {
    return this.resolveScopedPath(this.trashDir, fileName);
  }

  private resolveScopedPath(root: string, fileName: string): string {
    if (fileName.includes('/') || fileName.includes('\\') || !fileName.endsWith('.html')) {
      throw new Error(`Invalid note filename: ${fileName}`);
    }

    const resolved = path.resolve(root, fileName);
    if (!resolved.startsWith(`${root}${path.sep}`)) {
      throw new Error(`Unsafe note path: ${fileName}`);
    }

    return resolved;
  }

  private async atomicWrite(targetPath: string, content: string): Promise<void> {
    const tempPath = `${targetPath}.${randomUUID()}.tmp`;
    await writeFile(tempPath, content, 'utf8');
    await rename(tempPath, targetPath);
  }

  private async withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.writeQueue.then(operation, operation);
    this.writeQueue = run.catch(() => undefined);
    return run;
  }
}
