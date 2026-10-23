export interface OpenAIRequest {
  systemPrompt: string;
  userPrompt: string;
  responseFormat?: { type: 'json_object' };
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface OpenAIResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  timeoutMs: number;
  temperature?: number;
}

function getConfig(): OpenAIConfig | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'sk-your-openai-api-key-here') {
    console.warn('[OpenAI] OPENAI_API_KEY not configured, will use fallback mode');
    return null;
  }
  return {
    apiKey,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2048', 10),
    timeoutMs: parseInt(process.env.OPENAI_TIMEOUT_MS || '30000', 10),
    temperature: 0.7,
  };
}

export async function callOpenAI(request: OpenAIRequest): Promise<OpenAIResponse | null> {
  const config = getConfig();
  if (!config) {
    return null;
  }

  const body = JSON.stringify({
    model: request.model || config.model,
    messages: [
      { role: 'system', content: request.systemPrompt },
      { role: 'user', content: request.userPrompt },
    ],
    max_tokens: request.maxTokens || config.maxTokens,
    temperature: request.temperature ?? config.temperature,
    ...(request.responseFormat ? { response_format: request.responseFormat } : {}),
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[OpenAI] API error ${response.status}: ${errorBody}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    return {
      content: content || '',
      usage: data.usage,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[OpenAI] Request timeout after ${config.timeoutMs}ms`);
    } else {
      console.error('[OpenAI] Request failed:', error);
    }
    return null;
  }
}

export async function callOpenAIJSON(request: OpenAIRequest): Promise<unknown | null> {
  const result = await callOpenAI({
    ...request,
    responseFormat: { type: 'json_object' },
  });

  if (!result || !result.content) {
    return null;
  }

  try {
    const cleaned = result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('[OpenAI] Failed to parse JSON response:', error);
    console.error('[OpenAI] Raw content:', result.content);
    return null;
  }
}

export function isOpenAIAvailable(): boolean {
  const config = getConfig();
  return config !== null;
}
