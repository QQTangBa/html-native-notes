import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface HtmlWriteReviewInput {
  sourcePath: string;
  expectedSourceHash: string;
  originalHtml: string;
  editedHtml: string;
}

export interface HtmlWriteReview {
  sourcePath: string;
  expectedSourceHash: string;
  originalHtml: string;
  editedHtml: string;
  status: 'unchanged' | 'changed';
  diff: string;
}

export type WriteDecision =
  | { action: 'cancel'; saveAsPath?: string }
  | { action: 'save-as'; saveAsPath: string }
  | { action: 'write-back' };

export interface WriteDecisionResult {
  action: WriteDecision['action'];
  outputPath?: string;
}

export async function hashFile(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return createHash('sha256').update(content).digest('hex');
}

function splitLines(value: string): string[] {
  return value.endsWith('\n') ? value.slice(0, -1).split('\n') : value.split('\n');
}

function createReadableDiff(originalHtml: string, editedHtml: string): string {
  if (originalHtml === editedHtml) {
    return '';
  }

  const originalLines = splitLines(originalHtml);
  const editedLines = splitLines(editedHtml);
  const maxLength = Math.max(originalLines.length, editedLines.length);
  const diff: string[] = [];

  for (let index = 0; index < maxLength; index += 1) {
    const originalLine = originalLines[index];
    const editedLine = editedLines[index];

    if (originalLine === editedLine) {
      if (originalLine !== undefined) {
        diff.push(` ${originalLine}`);
      }
      continue;
    }

    if (originalLine !== undefined) {
      diff.push(`-${originalLine}`);
    }

    if (editedLine !== undefined) {
      diff.push(`+${editedLine}`);
    }
  }

  return diff.join('\n');
}

export async function reviewHtmlWrite(input: HtmlWriteReviewInput): Promise<HtmlWriteReview> {
  return {
    sourcePath: input.sourcePath,
    expectedSourceHash: input.expectedSourceHash,
    originalHtml: input.originalHtml,
    editedHtml: input.editedHtml,
    status: input.originalHtml === input.editedHtml ? 'unchanged' : 'changed',
    diff: createReadableDiff(input.originalHtml, input.editedHtml),
  };
}

export async function applyWriteDecision(
  review: HtmlWriteReview,
  decision: WriteDecision,
): Promise<WriteDecisionResult> {
  if (decision.action === 'cancel') {
    return { action: 'cancel' };
  }

  if (decision.action === 'save-as') {
    await mkdir(path.dirname(decision.saveAsPath), { recursive: true });
    await writeFile(decision.saveAsPath, review.editedHtml, 'utf8');
    return { action: 'save-as', outputPath: decision.saveAsPath };
  }

  const currentHash = await hashFile(review.sourcePath);
  if (currentHash !== review.expectedSourceHash) {
    throw new Error(
      `Source changed before write-back: expected ${review.expectedSourceHash}, received ${currentHash}`,
    );
  }

  await writeFile(review.sourcePath, review.editedHtml, 'utf8');
  return { action: 'write-back', outputPath: review.sourcePath };
}
