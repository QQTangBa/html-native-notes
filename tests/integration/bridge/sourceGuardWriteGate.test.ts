// @vitest-environment node

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyWriteDecision,
  hashFile,
  reviewHtmlWrite,
} from '../../../bridge/sourceGuard/writeGate';

let tempDir: string;
let sourcePath: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), 'html-native-write-gate-'));
  sourcePath = path.join(tempDir, 'source.html');
  await writeFile(sourcePath, '<h1>Original</h1>\n<p>Alpha</p>\n', 'utf8');
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('Source Guard write gate', () => {
  it('reviews an edit with readable diff without changing the source file', async () => {
    const sourceHash = await hashFile(sourcePath);
    const originalHtml = await readFile(sourcePath, 'utf8');

    const review = await reviewHtmlWrite({
      sourcePath,
      expectedSourceHash: sourceHash,
      originalHtml,
      editedHtml: '<h1>Original</h1>\n<p>Beta</p>\n',
    });

    expect(review.status).toBe('changed');
    expect(review.diff).toContain('-<p>Alpha</p>');
    expect(review.diff).toContain('+<p>Beta</p>');
    expect(await hashFile(sourcePath)).toBe(sourceHash);
  });

  it('cancels an edit without writing either source or save-as target', async () => {
    const sourceHash = await hashFile(sourcePath);
    const review = await reviewHtmlWrite({
      sourcePath,
      expectedSourceHash: sourceHash,
      originalHtml: await readFile(sourcePath, 'utf8'),
      editedHtml: '<h1>Changed</h1>\n',
    });
    const saveAsPath = path.join(tempDir, 'changed.html');

    const result = await applyWriteDecision(review, { action: 'cancel', saveAsPath });

    expect(result.action).toBe('cancel');
    expect(await hashFile(sourcePath)).toBe(sourceHash);
    await expect(readFile(saveAsPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('saves an edit as a new file while preserving the original source hash', async () => {
    const sourceHash = await hashFile(sourcePath);
    const review = await reviewHtmlWrite({
      sourcePath,
      expectedSourceHash: sourceHash,
      originalHtml: await readFile(sourcePath, 'utf8'),
      editedHtml: '<h1>Save As</h1>\n',
    });
    const saveAsPath = path.join(tempDir, 'exports', 'save-as.html');

    const result = await applyWriteDecision(review, { action: 'save-as', saveAsPath });

    expect(result.action).toBe('save-as');
    expect(result.outputPath).toBe(saveAsPath);
    expect(await readFile(saveAsPath, 'utf8')).toBe('<h1>Save As</h1>\n');
    expect(await hashFile(sourcePath)).toBe(sourceHash);
  });

  it('writes back only when the source hash still matches the reviewed version', async () => {
    const sourceHash = await hashFile(sourcePath);
    const review = await reviewHtmlWrite({
      sourcePath,
      expectedSourceHash: sourceHash,
      originalHtml: await readFile(sourcePath, 'utf8'),
      editedHtml: '<h1>Write Back</h1>\n',
    });

    const result = await applyWriteDecision(review, { action: 'write-back' });

    expect(result.action).toBe('write-back');
    expect(await readFile(sourcePath, 'utf8')).toBe('<h1>Write Back</h1>\n');
  });

  it('rejects write-back when the source changed after review', async () => {
    const sourceHash = await hashFile(sourcePath);
    const review = await reviewHtmlWrite({
      sourcePath,
      expectedSourceHash: sourceHash,
      originalHtml: await readFile(sourcePath, 'utf8'),
      editedHtml: '<h1>Write Back</h1>\n',
    });
    await writeFile(sourcePath, '<h1>External change</h1>\n', 'utf8');

    await expect(applyWriteDecision(review, { action: 'write-back' })).rejects.toThrow(
      /Source changed before write-back/,
    );
  });
});
