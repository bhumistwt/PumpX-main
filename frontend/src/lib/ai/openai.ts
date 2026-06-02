const DEFAULT_MODEL = 'gpt-4o-mini';

export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

function estimateTokens(messages: OpenAIChatMessage[]): number {
  const chars = messages.reduce((sum, m) => sum + m.content.length, 0);
  return Math.ceil(chars / 4) + 50;
}

/**
 * Shared OpenAI chat call with cost guardrails.
 * Returns null if OPENAI_API_KEY is missing or the request fails.
 */
export async function callOpenAIChat(
  endpoint: string,
  messages: OpenAIChatMessage[],
  options: OpenAIChatOptions = {},
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  const estimatedTokens = estimateTokens(messages);

  if (!apiKey) {
    console.log('[AI]', endpoint, estimatedTokens, '(skipped — no OPENAI_API_KEY)');
    return null;
  }

  console.log('[AI]', endpoint, estimatedTokens);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model ?? DEFAULT_MODEL,
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens ?? 600,
        messages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[AI]', endpoint, 'error', res.status, errText.slice(0, 200));
      return null;
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content : null;
  } catch (err) {
    console.error('[AI]', endpoint, 'exception', err);
    return null;
  }
}
