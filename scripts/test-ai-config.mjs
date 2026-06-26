import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function loadEnv(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^["']|["']$/g, '')];
      }),
  );
}

const env = { ...loadEnv(path.resolve(process.cwd(), '.env.local')), ...process.env };
const baseUrl = env.AI_BASE_URL?.replace(/\/+$/g, '');
const model = env.AI_MODEL;
const apiKey = env.AI_API_KEY;

if (!baseUrl || !model || !apiKey) {
  console.error('AI config missing: AI_BASE_URL, AI_MODEL, and AI_API_KEY are required.');
  process.exit(1);
}

const response = await fetch(`${baseUrl}/chat/completions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model,
    messages: [
      {
        role: 'user',
        content: 'Reply with exactly: HTML Native Notes AI OK',
      },
    ],
    temperature: 0,
    max_tokens: Number(env.AI_MAX_TOKENS || 256),
  }),
});

const body = await response.json().catch(() => ({}));

if (!response.ok) {
  console.error(`AI provider test failed with HTTP ${response.status}: ${body.error?.message || 'unknown error'}`);
  process.exit(1);
}

const text = body.choices?.[0]?.message?.content?.trim() || '';

if (!text) {
  console.error('AI provider returned an empty response.');
  process.exit(1);
}

console.log(`AI provider reachable. Model=${model}. Response=${text}`);
