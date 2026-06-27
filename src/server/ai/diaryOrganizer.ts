import type { AppConfig, DiaryOrganizationRequest, DiaryOrganizationResponse, DiaryOrganizationStyle } from '../../shared/types';

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

type FetchLike = typeof fetch;

const styleOrder: DiaryOrganizationStyle['style'][] = ['timeline', 'themes'];

export function buildDiaryMessages(request: DiaryOrganizationRequest): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        'You are a private diary organization assistant. Create exactly two organization styles and preserve the original diary. ' +
        'Return JSON only, no markdown fences. Shape: {"styles":[{"style":"timeline","title":"...","summary":"...","html":"..."},{"style":"themes","title":"...","summary":"...","html":"..."}]}. ' +
        'The timeline style should organize by time or sequence. The themes style should organize by emotion, events, decisions, and next reminders. ' +
        'Use concise Chinese titles and semantic HTML sections.',
    },
    {
      role: 'user',
      content: `Original diary:\n${request.originalText}`,
    },
  ];
}

function buildChatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/g, '')}/chat/completions`;
}

function stripJsonFence(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

function parseDiaryStyles(content: string): DiaryOrganizationStyle[] {
  const parsed = JSON.parse(stripJsonFence(content)) as { styles?: unknown };
  if (!Array.isArray(parsed.styles)) {
    throw new Error('AI diary response did not include styles');
  }

  const styles = parsed.styles
    .map((style) => {
      if (!style || typeof style !== 'object') {
        return undefined;
      }

      const candidate = style as Partial<DiaryOrganizationStyle>;
      if (
        !candidate.style ||
        !styleOrder.includes(candidate.style) ||
        typeof candidate.title !== 'string' ||
        typeof candidate.summary !== 'string' ||
        typeof candidate.html !== 'string'
      ) {
        return undefined;
      }

      return {
        style: candidate.style,
        title: candidate.title,
        summary: candidate.summary,
        html: candidate.html,
      };
    })
    .filter((style): style is DiaryOrganizationStyle => Boolean(style));

  const byStyle = new Map(styles.map((style) => [style.style, style]));
  const ordered = styleOrder.map((style) => byStyle.get(style)).filter((style): style is DiaryOrganizationStyle => Boolean(style));

  if (ordered.length !== 2) {
    throw new Error('AI diary response must include timeline and themes styles');
  }

  return ordered;
}

export async function runDiaryOrganization(
  config: AppConfig,
  request: DiaryOrganizationRequest,
  fetchImpl: FetchLike = fetch,
): Promise<DiaryOrganizationResponse> {
  if (!config.ai.baseUrl) {
    throw new Error('AI_BASE_URL is required before running diary organization');
  }

  if (!config.ai.model) {
    throw new Error('AI_MODEL is required before running diary organization');
  }

  if (!config.ai.apiKey) {
    throw new Error('AI_API_KEY is required before running diary organization');
  }

  const response = await fetchImpl(buildChatCompletionsUrl(config.ai.baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.ai.apiKey}`,
    },
    body: JSON.stringify({
      model: config.ai.model,
      messages: buildDiaryMessages(request),
      temperature: config.ai.temperature,
      max_tokens: config.ai.maxTokens,
      response_format: { type: 'json_object' },
    }),
  });

  const body = (await response.json()) as ChatCompletionResponse;
  if (!response.ok) {
    throw new Error(body.error?.message || `AI provider returned HTTP ${response.status}`);
  }

  const content = body.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI provider returned an empty diary organization response');
  }

  return {
    originalText: request.originalText,
    styles: parseDiaryStyles(content),
  };
}
