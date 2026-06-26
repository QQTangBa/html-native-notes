import type { AiActionRequest, AiActionResponse, NoteMeta, NoteRecord, SafeAiStatus } from '../types';

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as T | { error?: { message?: string } } | null;

  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && body.error?.message
        ? body.error.message
        : `Request failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  return body as T;
}

export const apiClient = {
  async listNotes(): Promise<NoteMeta[]> {
    return parseResponse<NoteMeta[]>(await fetch('/api/notes'));
  },

  async createNote(input: { title: string; content?: string; tags?: string[] }): Promise<NoteMeta> {
    return parseResponse<NoteMeta>(
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    );
  },

  async getNote(id: string): Promise<NoteRecord> {
    return parseResponse<NoteRecord>(await fetch(`/api/notes/${id}`));
  },

  async saveNoteContent(id: string, content: string): Promise<NoteMeta> {
    return parseResponse<NoteMeta>(
      await fetch(`/api/notes/${id}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      }),
    );
  },

  async duplicateNote(id: string): Promise<NoteMeta> {
    return parseResponse<NoteMeta>(await fetch(`/api/notes/${id}/duplicate`, { method: 'POST' }));
  },

  async deleteNote(id: string): Promise<void> {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' }).then((response) => {
      if (!response.ok) {
        throw new Error(`Delete failed with HTTP ${response.status}`);
      }
    });
  },

  async aiStatus(): Promise<SafeAiStatus> {
    return parseResponse<SafeAiStatus>(await fetch('/api/config/ai/status'));
  },

  async runAiAction(input: AiActionRequest): Promise<AiActionResponse> {
    return parseResponse<AiActionResponse>(
      await fetch('/api/ai/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    );
  },
};
