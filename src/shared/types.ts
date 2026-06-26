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
  ai: AiRuntimeConfig;
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
