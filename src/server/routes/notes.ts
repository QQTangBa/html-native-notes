import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { FileNoteStore } from '../storage/noteStore';

const createNoteSchema = z.object({
  title: z.string().min(1),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const patchNoteSchema = z.object({
  title: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
});

const saveContentSchema = z.object({
  content: z.string(),
});

export async function registerNoteRoutes(app: FastifyInstance, store: FileNoteStore): Promise<void> {
  app.get('/api/notes', async () => store.listNotes());

  app.post('/api/notes', async (request, reply) => {
    const input = createNoteSchema.parse(request.body);
    const note = await store.createNote(input);
    return reply.code(201).send(note);
  });

  app.get('/api/notes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      return await store.getNote(id);
    } catch (error) {
      return reply.code(404).send({
        error: {
          code: 'NOTE_NOT_FOUND',
          message: error instanceof Error ? error.message : 'Note not found',
        },
      });
    }
  });

  app.patch('/api/notes/:id', async (request) => {
    const { id } = request.params as { id: string };
    return store.updateNote(id, patchNoteSchema.parse(request.body));
  });

  app.put('/api/notes/:id/content', async (request) => {
    const { id } = request.params as { id: string };
    const input = saveContentSchema.parse(request.body);
    return store.saveNoteContent(id, input.content);
  });

  app.post('/api/notes/:id/duplicate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const note = await store.duplicateNote(id);
    return reply.code(201).send(note);
  });

  app.delete('/api/notes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await store.deleteNote(id);
    return reply.code(204).send();
  });
}
