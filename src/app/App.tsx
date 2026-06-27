import { useEffect, useMemo, useState } from 'react';
import { AiPanel } from '../features/ai/AiPanel';
import { HtmlEditor } from '../features/editor/HtmlEditor';
import { NoteLibrary } from '../features/notes/NoteLibrary';
import { PreviewPane } from '../features/preview/PreviewPane';
import { SettingsPanel } from '../features/settings/SettingsPanel';
import { VaultHome } from '../features/vault/VaultHome';
import { apiClient } from '../shared/api/client';
import type { AiAction, NoteMeta, NoteRecord, SafeAiStatus, VaultLibraryResponse } from '../shared/types';

const starterHtml = '<!doctype html><html><body><article><h1>新 HTML 笔记</h1><p>开始写你的内容。</p></article></body></html>';

export function App() {
  const [notes, setNotes] = useState<NoteMeta[]>([]);
  const [activeNote, setActiveNote] = useState<NoteRecord | undefined>();
  const [newTitle, setNewTitle] = useState('新 HTML 笔记');
  const [source, setSource] = useState(starterHtml);
  const [aiStatus, setAiStatus] = useState<SafeAiStatus>();
  const [vaultLibrary, setVaultLibrary] = useState<VaultLibraryResponse>();
  const [thumbnailBusy, setThumbnailBusy] = useState(false);
  const [thumbnailMessage, setThumbnailMessage] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const activeNoteId = activeNote?.id;
  const statusLine = useMemo(() => {
    if (error) {
      return error;
    }

    if (activeNote) {
      return `Editing ${activeNote.title}`;
    }

    return 'Ready';
  }, [activeNote, error]);

  useEffect(() => {
    void refresh();
    void refreshVaultLibrary();
    void apiClient.aiStatus().then(setAiStatus).catch(() => setAiStatus({ configured: false, baseUrlSet: false }));
  }, []);

  async function refresh(): Promise<void> {
    setNotes(await apiClient.listNotes());
  }

  async function refreshVaultLibrary(): Promise<void> {
    await apiClient.listVaultLibrary().then(setVaultLibrary).catch(() => setVaultLibrary(undefined));
  }

  async function runTask(task: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }

  async function openNote(id: string): Promise<void> {
    await runTask(async () => {
      const note = await apiClient.getNote(id);
      setActiveNote(note);
      setSource(note.content);
    });
  }

  async function createNote(): Promise<void> {
    await runTask(async () => {
      const title = newTitle.trim() || '新 HTML 笔记';
      const content = starterHtml.replace('新 HTML 笔记', title);
      const note = await apiClient.createNote({
        title,
        content,
      });
      setNotes((current) => [note, ...current.filter((item) => item.id !== note.id)]);
      setActiveNote({ ...note, content });
      setSource(content);
    });
  }

  async function saveNote(): Promise<void> {
    if (!activeNoteId) {
      return;
    }

    await runTask(async () => {
      const updated = await apiClient.saveNoteContent(activeNoteId, source);
      setActiveNote({ ...activeNote!, ...updated, content: source });
      await refresh();
    });
  }

  async function duplicateNote(): Promise<void> {
    if (!activeNoteId) {
      return;
    }

    await runTask(async () => {
      const copy = await apiClient.duplicateNote(activeNoteId);
      await refresh();
      await openNote(copy.id);
    });
  }

  async function deleteNote(): Promise<void> {
    if (!activeNoteId) {
      return;
    }

    await runTask(async () => {
      await apiClient.deleteNote(activeNoteId);
      setActiveNote(undefined);
      setSource(starterHtml);
      await refresh();
    });
  }

  async function runAi(action: AiAction): Promise<void> {
    await runTask(async () => {
      const response = await apiClient.runAiAction({ action, content: source });
      setAiResult(response.result);
    });
  }

  async function generateVaultThumbnails(): Promise<void> {
    setThumbnailBusy(true);
    setThumbnailMessage('Rendering thumbnails');
    setError('');

    try {
      const result = await apiClient.generateVaultThumbnails();
      await refreshVaultLibrary();
      setThumbnailMessage(
        result.generatedCount > 0
          ? `${result.generatedCount} thumbnail${result.generatedCount === 1 ? '' : 's'} ready`
          : 'Thumbnails ready',
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '缩略图生成失败');
      setThumbnailMessage('Thumbnail generation failed');
    } finally {
      setThumbnailBusy(false);
    }
  }

  function insertAiResult(): void {
    if (!aiResult) {
      return;
    }

    setSource((current) => `${current}\n${aiResult}`);
    setAiResult('');
  }

  if (vaultLibrary?.items.length) {
    return (
      <main className="desktop-vault-shell" data-testid="workspace-shell">
        <VaultHome
          items={vaultLibrary.items}
          thumbnailBusy={thumbnailBusy}
          thumbnailMessage={thumbnailMessage || undefined}
          onGenerateThumbnails={() => void generateVaultThumbnails()}
        />
        <div className={error ? 'status-bar error' : 'status-bar'}>{statusLine}</div>
      </main>
    );
  }

  return (
    <main className="workspace-shell" data-testid="workspace-shell">
      <NoteLibrary
        notes={notes}
        activeNoteId={activeNoteId}
        newTitle={newTitle}
        busy={busy}
        onTitleChange={setNewTitle}
        onCreate={() => void createNote()}
        onOpen={(id) => void openNote(id)}
        onSave={() => void saveNote()}
        onDuplicate={() => void duplicateNote()}
        onDelete={() => void deleteNote()}
      />

      <HtmlEditor value={source} onChange={setSource} />

      <aside className="panel side-panel">
        <SettingsPanel status={aiStatus} />
        <PreviewPane html={source} />
        <AiPanel status={aiStatus} busy={busy} result={aiResult} onRun={(action) => void runAi(action)} onInsert={insertAiResult} />
      </aside>

      <div className={error ? 'status-bar error' : 'status-bar'}>{statusLine}</div>
    </main>
  );
}
