import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NoteLibrary } from '../../src/features/notes/NoteLibrary';
import type { NoteMeta } from '../../src/shared/types';

const notes: NoteMeta[] = [
  {
    id: 'note_beta',
    title: 'Beta',
    slug: 'beta',
    fileName: 'beta.html',
    createdAt: '2026-06-27T00:00:00.000Z',
    updatedAt: '2026-06-27T00:05:00.000Z',
    tags: ['market'],
    wikilinks: ['Alpha'],
    backlinks: ['Gamma'],
    archived: false,
  },
];

describe('NoteLibrary', () => {
  it('renders Markdown-style tags, wikilinks, and backlinks for saved notes', () => {
    render(
      <NoteLibrary
        notes={notes}
        activeNoteId="note_beta"
        newTitle="New"
        busy={false}
        onTitleChange={vi.fn()}
        onCreate={vi.fn()}
        onOpen={vi.fn()}
        onSave={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const note = screen.getByRole('button', { name: /Beta/ });
    expect(within(note).getByText('#market')).toBeInTheDocument();
    expect(within(note).getByText('[[Alpha]]')).toBeInTheDocument();
    expect(within(note).getByText('backlink: Gamma')).toBeInTheDocument();
  });
});
