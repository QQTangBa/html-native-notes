import { describe, expect, it, vi } from 'vitest';
import { buildAiMessages, runAiAction } from '../../src/server/ai/openAiCompatibleClient';
import type { AppConfig } from '../../src/shared/types';

const configured: AppConfig = {
  env: 'test',
  host: '127.0.0.1',
  port: 5178,
  dataDir: './data',
  ai: {
    baseUrl: 'https://api.example.com',
    model: 'model-a',
    apiKey: 'sk-test',
    temperature: 0.2,
    maxTokens: 512,
  },
};

describe('AI client', () => {
  it('builds action-specific messages', () => {
    expect(buildAiMessages({ action: 'summarize', content: '<p>Long note</p>' })[0]?.content).toContain('summarize');
    expect(buildAiMessages({ action: 'clean-html', content: '<p>x</p>' })[0]?.content).toContain('clean semantic HTML');
    expect(
      buildAiMessages({
        action: 'translate',
        content: '<p>Hello</p>',
        language: 'Chinese',
      })[0]?.content,
    ).toContain('Chinese');
  });

  it('rejects real calls when API key is missing', async () => {
    await expect(
      runAiAction(
        {
          ...configured,
          ai: { ...configured.ai, apiKey: undefined },
        },
        { action: 'summarize', content: '<p>x</p>' },
      ),
    ).rejects.toThrow(/AI_API_KEY is required/);
  });

  it('calls an OpenAI-compatible chat completions endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '<section>Generated</section>' } }],
      }),
    });

    const result = await runAiAction(configured, { action: 'generate-section', content: '<h1>Topic</h1>' }, fetchImpl);

    expect(result.result).toBe('<section>Generated</section>');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example.com/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-test',
        }),
      }),
    );
    expect(JSON.stringify(fetchImpl.mock.calls[0])).not.toContain('undefined');
  });
});
