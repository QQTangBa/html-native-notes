import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface RegisteredWebService {
  id: string;
  title: string;
  cwd: string;
  startCommand: string;
  stopCommand?: string;
  url: string;
  port?: number;
  healthCheckUrl?: string;
  envHints: string[];
  logPath: string;
  startedByApp: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceRegistry {
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  services: RegisteredWebService[];
}

export interface ServiceRuntimeResult {
  status: 'running' | 'stopped' | 'failed';
  serviceId: string;
  cwd: string;
  command: string;
  logPath: string;
  startedByApp: boolean;
}

interface StartOptions {
  timeoutMs?: number;
}

const runningProcesses = new Map<string, ChildProcessWithoutNullStreams>();

function emptyRegistry(now = new Date().toISOString()): ServiceRegistry {
  return {
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    services: [],
  };
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tempPath = `${filePath}.tmp`;

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(tempPath, filePath);
}

export async function readServiceRegistry(registryPath: string): Promise<ServiceRegistry> {
  try {
    return JSON.parse(await readFile(registryPath, 'utf8')) as ServiceRegistry;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return emptyRegistry();
    }

    throw error;
  }
}

export async function registerWebService(
  registryPath: string,
  input: Omit<RegisteredWebService, 'startedByApp' | 'createdAt' | 'updatedAt'>,
): Promise<RegisteredWebService> {
  const registry = await readServiceRegistry(registryPath);
  const now = new Date().toISOString();
  const existing = registry.services.find((service) => service.id === input.id);
  const service: RegisteredWebService = {
    ...input,
    startedByApp: existing?.startedByApp ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const nextServices = existing
    ? registry.services.map((item) => (item.id === input.id ? service : item))
    : [...registry.services, service];

  await writeJsonAtomic(registryPath, {
    ...registry,
    updatedAt: now,
    services: nextServices,
  });

  return service;
}

async function findService(registryPath: string, serviceId: string): Promise<RegisteredWebService> {
  const service = (await readServiceRegistry(registryPath)).services.find((item) => item.id === serviceId);

  if (!service) {
    throw new Error(`Service not found: ${serviceId}`);
  }

  return service;
}

async function appendLog(logPath: string, content: string): Promise<void> {
  await mkdir(path.dirname(logPath), { recursive: true });
  await writeFile(logPath, content, { encoding: 'utf8', flag: 'a' });
}

async function healthCheck(service: RegisteredWebService): Promise<boolean> {
  const url = service.healthCheckUrl ?? service.url;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(300) });
    return response.ok;
  } catch {
    return false;
  }
}

function shellCommand(command: string): { shell: string; args: string[] } {
  return {
    shell: '/bin/zsh',
    args: ['-lc', command],
  };
}

function resultFor(service: RegisteredWebService, status: ServiceRuntimeResult['status']): ServiceRuntimeResult {
  return {
    status,
    serviceId: service.id,
    cwd: service.cwd,
    command: service.startCommand,
    logPath: service.logPath,
    startedByApp: runningProcesses.has(service.id),
  };
}

export function createServiceRuntimeManager(registryPath: string) {
  return {
    async health(serviceId: string): Promise<ServiceRuntimeResult> {
      const service = await findService(registryPath, serviceId);
      const running = await healthCheck(service);

      return resultFor(service, running ? 'running' : 'stopped');
    },

    async start(serviceId: string, options: StartOptions = {}): Promise<ServiceRuntimeResult> {
      const service = await findService(registryPath, serviceId);

      if (await healthCheck(service)) {
        return resultFor(service, 'running');
      }

      const command = shellCommand(service.startCommand);
      const child = spawn(command.shell, command.args, {
        cwd: service.cwd,
        env: process.env,
      });
      runningProcesses.set(service.id, child);
      const pendingLogWrites: Promise<void>[] = [];
      const queueLog = (chunk: Buffer): void => {
        const write = appendLog(service.logPath, String(chunk));
        pendingLogWrites.push(write);
        void write.catch(() => undefined);
      };
      const flushLogs = async (): Promise<void> => {
        await Promise.allSettled(pendingLogWrites);
      };

      child.stdout.on('data', queueLog);
      child.stderr.on('data', queueLog);
      child.on('exit', () => {
        runningProcesses.delete(service.id);
      });

      const timeoutMs = options.timeoutMs ?? 1200;
      const startedAt = Date.now();

      while (Date.now() - startedAt < timeoutMs) {
        if (await healthCheck(service)) {
          return resultFor(service, 'running');
        }

        if (child.exitCode !== null) {
          await flushLogs();
          return resultFor(service, 'failed');
        }

        await new Promise((resolve) => setTimeout(resolve, 40));
      }

      if (child.exitCode !== null) {
        await flushLogs();
        return resultFor(service, 'failed');
      }

      return resultFor(service, 'failed');
    },

    async stop(serviceId: string): Promise<ServiceRuntimeResult> {
      const service = await findService(registryPath, serviceId);
      const child = runningProcesses.get(service.id);

      if (child) {
        child.kill('SIGTERM');
        runningProcesses.delete(service.id);
      }

      return resultFor(service, 'stopped');
    },
  };
}
