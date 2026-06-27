export interface NoteMeta {
  id: string;
  title: string;
  slug: string;
  fileName: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  archived: boolean;
}

export interface NoteRecord extends NoteMeta {
  content: string;
}

export interface AiRuntimeConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
  temperature: number;
  maxTokens: number;
}

export interface SafeAiStatus {
  configured: boolean;
  baseUrlSet: boolean;
  model?: string;
}

export interface AppConfig {
  env: 'development' | 'production' | 'test';
  host: string;
  port: number;
  dataDir: string;
  vaultDir: string;
  ai: AiRuntimeConfig;
}

export interface VaultLibraryItem {
  id: string;
  kind: 'html-note' | 'service' | 'project';
  title: string;
  source: 'bridge';
  sourceAgent?: string;
  sourcePath?: string;
  relativeSourcePath?: string;
  folderPath: string;
  tags: string[];
  summary: string;
  updatedAt: string;
  thumbnail: {
    status: 'ready' | 'pending';
    path: string;
  };
}

export interface VaultLibraryResponse {
  items: VaultLibraryItem[];
  folders: Array<{
    path: string;
    itemCount: number;
  }>;
  availableFilters: {
    tags: string[];
    sourceAgents: string[];
    kinds: VaultLibraryItem['kind'][];
  };
}

export interface VaultThumbnailGenerationResponse {
  ok: true;
  generatedCount: number;
  skippedCount: number;
  generated: Array<{
    assetId: string;
    path: string;
  }>;
  skipped: Array<{
    assetId: string;
    reason: 'not-html' | 'missing-source' | 'already-exists';
  }>;
}

export interface VaultAssetSourceResponse {
  assetId: string;
  title: string;
  sourcePath: string;
  sourceHash?: string;
  currentHash: string;
  sourceHashMatches: boolean;
  html: string;
}

export interface VaultWriteReview {
  sourcePath: string;
  expectedSourceHash: string;
  originalHtml: string;
  editedHtml: string;
  status: 'unchanged' | 'changed';
  diff: string;
}

export type VaultWriteDecision =
  | { action: 'cancel'; saveAsPath?: string }
  | { action: 'save-as'; saveAsPath: string }
  | { action: 'write-back' };

export interface VaultWriteDecisionResult {
  action: VaultWriteDecision['action'];
  outputPath?: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type AiAction =
  | 'summarize'
  | 'rewrite'
  | 'outline'
  | 'translate'
  | 'generate-section'
  | 'clean-html';

export interface AiActionRequest {
  action: AiAction;
  content: string;
  selection?: string;
  language?: string;
}

export interface AiActionResponse {
  action: AiAction;
  result: string;
}
