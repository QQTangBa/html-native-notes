import { describe, expect, it, vi } from 'vitest';
import { buildDiaryMessages, runDiaryOrganization } from '../../src/server/ai/diaryOrganizer';
import type { AppConfig } from '../../src/shared/types';

const configured: AppConfig = {
  env: 'test',
  host: '127.0.0.1',
  port: 5178,
  dataDir: './data',
  vaultDir: './data/vault',
  ai: {
    baseUrl: 'https://api.example.com',
    model: 'model-a',
    apiKey: 'sk-diary-test',
    temperature: 0.2,
    maxTokens: 1024,
  },
  publish: { mode: 'disabled' },
};

describe('diary organizer AI adapter', () => {
  it('builds a prompt that asks for two organization styles while preserving the original text', () => {
    const messages = buildDiaryMessages({
      originalText: '今天状态很乱，但下午把项目推进了一点。',
    });

    expect(messages[0]?.content).toContain('two organization styles');
    expect(messages[0]?.content).toContain('preserve the original diary');
    expect(messages[1]?.content).toContain('今天状态很乱');
  });

  it('returns the caller original and parses two styled diary outputs', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                originalText: 'model must not replace this',
                styles: [
                  {
                    style: 'timeline',
                    title: '按时间线整理',
                    summary: '上午低迷，下午推进。',
                    html: '<section><h2>按时间线整理</h2><p>下午推进项目。</p></section>',
                  },
                  {
                    style: 'themes',
                    title: '按主题整理',
                    summary: '情绪、行动、明日提醒。',
                    html: '<section><h2>按主题整理</h2><p>行动恢复。</p></section>',
                  },
                ],
              }),
            },
          },
        ],
      }),
    });

    const result = await runDiaryOrganization(
      configured,
      {
        originalText: '今天状态很乱，但下午把项目推进了一点。',
      },
      fetchImpl,
    );

    expect(result.originalText).toBe('今天状态很乱，但下午把项目推进了一点。');
    expect(result.styles).toHaveLength(2);
    expect(result.styles.map((style) => style.style)).toEqual(['timeline', 'themes']);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example.com/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-diary-test',
        }),
      }),
    );
  });
});
