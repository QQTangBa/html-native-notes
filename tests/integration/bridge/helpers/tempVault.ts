import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export interface TempVaultFixture {
  tempDir: string;
  vaultDir: string;
  cleanup: () => Promise<void>;
}

export async function createTempVault(prefix: string): Promise<TempVaultFixture> {
  const tempDir = await mkdtemp(path.join(tmpdir(), prefix));
  const vaultDir = path.join(tempDir, 'Vault');
  await mkdir(vaultDir, { recursive: true });

  return {
    tempDir,
    vaultDir,
    cleanup: () => rm(tempDir, { recursive: true, force: true }),
  };
}

export async function sha256File(filePath: string): Promise<string> {
  return `sha256:${createHash('sha256').update(await readFile(filePath)).digest('hex')}`;
}
