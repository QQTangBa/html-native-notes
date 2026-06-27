import type { FastifyInstance } from 'fastify';
import { access, realpath } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { applyWriteDecision, hashFile, reviewHtmlWrite } from '../../../bridge/sourceGuard/writeGate';
import { buildVaultLibrary } from '../../../bridge/vault/library';
import { readVaultAssetSource } from '../../../bridge/vault/source';
import { generateMissingVaultThumbnails } from '../../../bridge/vault/thumbnails';
import {
  createVersionSnapshot,
  diffVersionSnapshots,
  listVersionSnapshots,
  rollbackToSnapshot,
  type VersionSnapshot,
} from '../../../bridge/vault/versionStore';
import type { AppConfig } from '../../shared/types';

const libraryQuerySchema = z.object({
  q: z.string().optional(),
  tag: z.union([z.string(), z.array(z.string())]).optional(),
  sourceAgent: z.union([z.string(), z.array(z.string())]).optional(),
  kind: z.union([z.enum(['html-note', 'service', 'project']), z.array(z.enum(['html-note', 'service', 'project']))]).optional(),
  folder: z.union([z.string(), z.array(z.string())]).optional(),
});

const assetParamsSchema = z.object({
  assetId: z.string().regex(/^asset_[A-Za-z0-9_-]+$/, 'Invalid asset id'),
});

const writeReviewBodySchema = z.object({
  editedHtml: z.string(),
});

const versionSnapshotBodySchema = z.object({
  reason: z.string().min(1).default('manual-snapshot'),
});

const versionDiffQuerySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

const versionRollbackBodySchema = z.object({
  snapshotId: z.string().min(1),
});

const writeDecisionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('cancel'),
    saveAsPath: z.string().optional(),
  }),
  z.object({
    action: z.literal('save-as'),
    saveAsPath: z.string().min(1),
  }),
  z.object({
    action: z.literal('write-back'),
  }),
]);

const writeDecisionBodySchema = z.object({
  assetId: z.string().regex(/^asset_[A-Za-z0-9_-]+$/, 'Invalid asset id'),
  editedHtml: z.string(),
  decision: writeDecisionSchema,
});

function asArray<T extends string>(value: T | T[] | undefined): T[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  return Array.isArray(value) ? value : [value];
}

function httpError(message: string, statusCode: number): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}

function isInside(parentPath: string, childPath: string, allowEqual = false): boolean {
  const relative = path.relative(parentPath, childPath);
  return (allowEqual && relative === '') || Boolean(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function nearestExistingParent(filePath: string): Promise<string> {
  let current = path.resolve(filePath);

  while (!(await pathExists(current))) {
    const parent = path.dirname(current);
    if (parent === current) {
      throw httpError('Write target parent does not exist', 400);
    }
    current = parent;
  }

  return realpath(current);
}

async function assertExistingFileInsideVault(vaultDir: string, filePath: string): Promise<void> {
  const [vaultRealPath, fileRealPath] = await Promise.all([realpath(vaultDir), realpath(filePath)]);
  if (!isInside(vaultRealPath, fileRealPath)) {
    throw httpError('Write target must stay inside the configured Vault', 400);
  }
}

async function assertWritableNewFileInsideVault(vaultDir: string, filePath: string): Promise<void> {
  const [vaultRealPath, nearestParentRealPath] = await Promise.all([
    realpath(vaultDir),
    nearestExistingParent(path.dirname(filePath)),
  ]);
  const vaultAbsolutePath = path.resolve(vaultDir);
  const targetAbsolutePath = path.resolve(filePath);

  if (!isInside(vaultAbsolutePath, targetAbsolutePath) || !isInside(vaultRealPath, nearestParentRealPath, true)) {
    throw httpError('Write target must stay inside the configured Vault', 400);
  }

  if (await pathExists(filePath)) {
    throw httpError('Save-as target already exists', 409);
  }
}

function toPublicVersionSnapshot(snapshot: VersionSnapshot): Omit<VersionSnapshot, 'contentPath'> {
  const { contentPath, ...publicSnapshot } = snapshot;
  void contentPath;
  return publicSnapshot;
}

async function publicVersionSnapshots(vaultDir: string, assetId: string): Promise<Array<Omit<VersionSnapshot, 'contentPath'>>> {
  return (await listVersionSnapshots(vaultDir, assetId)).map(toPublicVersionSnapshot);
}

export async function registerVaultRoutes(app: FastifyInstance, config: AppConfig): Promise<void> {
  app.get('/api/vault/library', async (request) => {
    const query = libraryQuerySchema.parse(request.query);

    return buildVaultLibrary({
      vaultDir: config.vaultDir,
      query: query.q,
      tags: asArray(query.tag),
      sourceAgents: asArray(query.sourceAgent),
      kinds: asArray(query.kind),
      folders: asArray(query.folder),
    });
  });

  app.post('/api/vault/thumbnails/generate', async () => {
    const result = await generateMissingVaultThumbnails({ vaultDir: config.vaultDir });

    return {
      ok: true,
      generatedCount: result.generated.length,
      skippedCount: result.skipped.length,
      ...result,
    };
  });

  app.get('/api/vault/assets/:assetId/source', async (request) => {
    const params = assetParamsSchema.parse(request.params);

    return readVaultAssetSource({
      vaultDir: config.vaultDir,
      assetId: params.assetId,
    });
  });

  app.get('/api/vault/assets/:assetId/versions', async (request) => {
    const params = assetParamsSchema.parse(request.params);

    return {
      snapshots: await publicVersionSnapshots(config.vaultDir, params.assetId),
    };
  });

  app.post('/api/vault/assets/:assetId/versions/snapshot', async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const body = versionSnapshotBodySchema.parse(request.body ?? {});
    const source = await readVaultAssetSource({
      vaultDir: config.vaultDir,
      assetId: params.assetId,
    });

    await assertExistingFileInsideVault(config.vaultDir, source.sourcePath);

    const snapshot = toPublicVersionSnapshot(
      await createVersionSnapshot({
        vaultDir: config.vaultDir,
        assetId: params.assetId,
        sourcePath: source.sourcePath,
        reason: body.reason,
      }),
    );

    return reply.code(201).send(snapshot);
  });

  app.get('/api/vault/assets/:assetId/versions/diff', async (request) => {
    const params = assetParamsSchema.parse(request.params);
    const query = versionDiffQuerySchema.parse(request.query);

    return diffVersionSnapshots({
      vaultDir: config.vaultDir,
      assetId: params.assetId,
      fromSnapshotId: query.from,
      toSnapshotId: query.to,
    });
  });

  app.post('/api/vault/assets/:assetId/versions/rollback', async (request) => {
    const params = assetParamsSchema.parse(request.params);
    const body = versionRollbackBodySchema.parse(request.body);
    const source = await readVaultAssetSource({
      vaultDir: config.vaultDir,
      assetId: params.assetId,
    });

    await assertExistingFileInsideVault(config.vaultDir, source.sourcePath);

    return {
      assetId: params.assetId,
      snapshotId: body.snapshotId,
      ...(await rollbackToSnapshot({
        vaultDir: config.vaultDir,
        assetId: params.assetId,
        snapshotId: body.snapshotId,
        targetPath: source.sourcePath,
      })),
    };
  });

  app.post('/api/vault/assets/:assetId/write-review', async (request) => {
    const params = assetParamsSchema.parse(request.params);
    const body = writeReviewBodySchema.parse(request.body);
    const source = await readVaultAssetSource({
      vaultDir: config.vaultDir,
      assetId: params.assetId,
    });

    await assertExistingFileInsideVault(config.vaultDir, source.sourcePath);

    return reviewHtmlWrite({
      sourcePath: source.sourcePath,
      expectedSourceHash: await hashFile(source.sourcePath),
      originalHtml: source.html,
      editedHtml: body.editedHtml,
    });
  });

  app.post('/api/vault/write-decision', async (request) => {
    const body = writeDecisionBodySchema.parse(request.body);
    const source = await readVaultAssetSource({
      vaultDir: config.vaultDir,
      assetId: body.assetId,
    });

    await assertExistingFileInsideVault(config.vaultDir, source.sourcePath);
    if (body.decision.action === 'save-as') {
      await assertWritableNewFileInsideVault(config.vaultDir, body.decision.saveAsPath);
    }

    const review = await reviewHtmlWrite({
      sourcePath: source.sourcePath,
      expectedSourceHash: await hashFile(source.sourcePath),
      originalHtml: source.html,
      editedHtml: body.editedHtml,
    });

    return applyWriteDecision(review, body.decision);
  });
}
