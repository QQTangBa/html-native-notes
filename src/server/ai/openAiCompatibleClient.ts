import type { AiActionRequest, AiActionResponse, AppConfig } from '../../shared/types';

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

type FetchLike = typeof fetch;

const actionInstructions: Record<AiActionRequest['action'], string> = {
  summarize: 'summarize this HTML note in concise Chinese bullet points while preserving key facts.',
  rewrite: 'rewrite the selected content in clearer natural Chinese and keep the original meaning.',
  outline: 'extract a structured outline from this HTML note.',
  translate: 'translate the provided HTML content to {{language}} while preserving tags when possible.',
  'generate-section': 'generate a useful semantic HTML section that fits the note context.',
  'clean-html': 'clean semantic HTML, remove noisy markup, and keep the content readable.',
};

export function buildAiMessages(request: AiActionRequest): ChatMessage[] {
  const language = request.language?.trim() || 'Chinese';
  const instruction = actionInstructions[request.action].replace('{{language}}', language);
  const selected = request.selection?.trim();

  return [
    {
      role: 'system',
      content: `You are an HTML-native note assistant. ${instruction} Return only the requested text or HTML, without markdown fences.`,
    },
    {
      role: 'user',
      content: selected ? `Selection:\n${selected}\n\nFull note context:\n${request.content}` : request.content,
    },
  ];
}

function buildChatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/g, '')}/chat/completions`;
}

export async function runAiAction(
  config: AppConfig,
  request: AiActionRequest,
  fetchImpl: FetchLike = fetch,
): Promise<AiActionResponse> {
  if (!config.ai.baseUrl) {
    throw new Error('AI_BASE_URL is required before running AI actions');
  }

  if (!config.ai.model) {
    throw new Error('AI_MODEL is required before running AI actions');
  }

  if (!config.ai.apiKey) {
    throw new Error('AI_API_KEY is required before running AI actions');
  }

  const response = await fetchImpl(buildChatCompletionsUrl(config.ai.baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.ai.apiKey}`,
    },
    body: JSON.stringify({
      model: config.ai.model,
      messages: buildAiMessages(request),
      temperature: config.ai.temperature,
      max_tokens: config.ai.maxTokens,
    }),
  });

  const body = (await response.json()) as ChatCompletionResponse;

  if (!response.ok) {
    throw new Error(body.error?.message || `AI provider returned HTTP ${response.status}`);
  }

  const result = body.choices?.[0]?.message?.content?.trim();

  if (!result) {
    const finishReason = body.choices?.[0] && 'finish_reason' in body.choices[0] ? body.choices[0].finish_reason : undefined;
    throw new Error(
      finishReason === 'length'
        ? 'AI provider returned an empty response because the token limit was reached before final content'
        : 'AI provider returned an empty response',
    );
  }

  return {
    action: request.action,
    result,
  };
}
