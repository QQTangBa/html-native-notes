import { z } from 'zod';

const nonEmptyTrimmedString = z.string().trim().min(1);
const isoDateString = z.string().datetime();

const tagSchema = z
  .array(z.string().trim().min(1).transform((tag) => tag.toLowerCase()))
  .default([]);

const htmlPathSchema = nonEmptyTrimmedString.refine(
  (value) => /\.(html|htm|ainote\.html)$/i.test(value),
  'HTML asset registrations must point to .html, .htm, or .ainote.html files',
);

const sourceHashSchema = nonEmptyTrimmedString.refine(
  (value) => /^sha256:[A-Za-z0-9._:-]+$/.test(value),
  'sourceHash must use a sha256: prefix',
);

export const htmlAssetRegistrationSchema = z
  .object({
    type: z.literal('registerHtmlAsset').default('registerHtmlAsset'),
    requestId: nonEmptyTrimmedString,
    filePath: htmlPathSchema,
    sourceHash: sourceHashSchema,
    title: nonEmptyTrimmedString.optional(),
    tags: tagSchema,
    sourceAgent: nonEmptyTrimmedString.optional(),
    summary: nonEmptyTrimmedString.optional(),
    createdAt: isoDateString.optional(),
  })
  .transform((request) => ({
    ...request,
    sourcePath: request.filePath,
  }));

const serviceUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => value.startsWith('http://127.0.0.1') || value.startsWith('http://localhost'), {
    message: 'V1 service registrations must use local HTTP URLs',
  });

export const webServiceRegistrationSchema = z
  .object({
    type: z.literal('registerWebService').default('registerWebService'),
    requestId: nonEmptyTrimmedString,
    title: nonEmptyTrimmedString,
    cwd: nonEmptyTrimmedString,
    startCommand: nonEmptyTrimmedString,
    stopCommand: nonEmptyTrimmedString.optional(),
    url: serviceUrlSchema,
    port: z.number().int().min(1).max(65535).optional(),
    healthCheckUrl: serviceUrlSchema.optional(),
    envHints: z.array(nonEmptyTrimmedString).default([]),
    logPath: nonEmptyTrimmedString.optional(),
    createdAt: isoDateString.optional(),
  })
  .transform((request) => ({
    type: request.type,
    requestId: request.requestId,
    createdAt: request.createdAt,
    service: {
      title: request.title,
      cwd: request.cwd,
      startCommand: request.startCommand,
      stopCommand: request.stopCommand,
      url: request.url,
      port: request.port,
      healthCheckUrl: request.healthCheckUrl,
      envHints: request.envHints,
      logPath: request.logPath,
    },
  }));

export const agentInboxRequestSchema = z.object({
  requestId: nonEmptyTrimmedString,
  type: z.enum(['registerHtmlAsset', 'registerWebService', 'snapshot', 'publish', 'importExisting']),
  createdAt: isoDateString,
  sourceAgent: nonEmptyTrimmedString.optional(),
  sourcePath: nonEmptyTrimmedString.optional(),
  sourceHash: sourceHashSchema.optional(),
  title: nonEmptyTrimmedString.optional(),
  tags: tagSchema,
  service: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type HtmlAssetRegistration = z.infer<typeof htmlAssetRegistrationSchema>;
export type WebServiceRegistrationRequest = z.infer<typeof webServiceRegistrationSchema>;
export type AgentInboxRequest = z.infer<typeof agentInboxRequestSchema>;
export type AgentInboxRequestInput = z.input<typeof agentInboxRequestSchema>;

export interface NormalizedBridgeRequest extends AgentInboxRequest {
  dedupeKey: string;
}

export function normalizeBridgeRequest(input: unknown): NormalizedBridgeRequest {
  const parsed = agentInboxRequestSchema.parse(input);
  const dedupeValue = parsed.sourceHash ?? parsed.sourcePath ?? parsed.requestId;

  return {
    ...parsed,
    requestId: parsed.requestId.trim(),
    dedupeKey: `${parsed.type}:${dedupeValue}`,
  };
}
