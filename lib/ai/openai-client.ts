import { CircuitBreaker, CircuitOpenError } from '@/lib/ai/circuit-breaker';

export interface OpenAIRequest {
  systemPrompt: string;
  userPrompt: string;
  responseFormat?: { type: 'json_object' };
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** 外部取消信号；与内置超时并行生效，任一中止即中断请求。 */
  signal?: AbortSignal;
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

  // 外部取消信号（任务终止）与内置超时并行：任一中止即中止底层请求。
  const external = request.signal;
  let externalAborted = false;
  if (external) {
    if (external.aborted) {
      controller.abort();
    } else {
      external.addEventListener('abort', () => {
        externalAborted = true;
        controller.abort();
      }, { once: true });
    }
  }

  try {
    // Route the network call through the circuit breaker: when the breaker is
    // open it short-circuits (rejecting with CircuitOpenError) so no HTTP
    // request is made and callers fall through to their rule-based fallback.
    const response = await circuitBreaker.run(async (): Promise<OpenAIResponse> => {
      const http = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body,
        signal: controller.signal,
      });

      if (!http.ok) {
        const errorBody = await http.text();
        console.error(`[OpenAI] API error ${http.status}: ${errorBody}`);
        throw new Error(`OpenAI API error ${http.status}`);
      }

      const data = await http.json();
      const content = data.choices?.[0]?.message?.content;

      return {
        content: content || '',
        usage: data.usage,
      };
    });

    clearTimeout(timeoutId);

    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof CircuitOpenError) {
      // 断路器开启：跳过网络请求，返回 null 让调用方走降级分支。
      console.error('[OpenAI] Circuit breaker open, skipping request');
      return null;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      if (externalAborted) {
        // 外部取消：直接放弃该请求，返回 null 让调用方走降级/取消分支。
        console.error('[OpenAI] Request aborted by caller (task terminated)');
        return null;
      }
      console.error(`[OpenAI] Request timeout after ${config.timeoutMs}ms`);
    } else {
      console.error('[OpenAI] Request failed:', error);
    }
    return null;
  } finally {
    if (external) {
      external.removeEventListener('abort', () => {
        externalAborted = true;
        controller.abort();
      });
    }
  }
}

/** Module-level circuit breaker guarding real OpenAI calls. */
const circuitBreaker = new CircuitBreaker();

/** Whether the OpenAI circuit breaker is currently open (calls short-circuited). */
export function isCircuitOpen(): boolean {
  return circuitBreaker.protected();
}

/** Test helper: reset the shared OpenAI circuit breaker to a clean closed state. */
export function resetCircuitBreakerForTests(): void {
  circuitBreaker.reset();
}

/** Exposed for tests: the shared breaker instance. */
export function getCircuitBreaker(): CircuitBreaker {
  return circuitBreaker;
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
