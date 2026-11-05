import {
  callGeminiUnified,
  type GeminiRequestOptions,
  type GeminiResponse,
} from './gemini-client';
import { firestoreSet } from '../../../worker/firebaseAdmin';

/**
 * Central AI Core for IAMTRADER.
 *
 * Gemini is primary; OpenAI is a controlled fallback for instrument suggestions only. Assistant identity,
 * prompts, input validation and HTTP response contracts remain in their
 * existing route handlers. The core owns provider invocation and defaults.
 *
 * Contents are passed through unchanged so Chloé can keep Gemini multimodal
 * parts (inlineData for images, PDFs and supported audio) without conversion
 * or accidental loss.
 */
export type AIAssistantId =
  | 'chloe'
  | 'vyra'
  | 'instrument-suggest'
  | 'economic-calendar-analysis';

export type AIProvider = 'gemini' | 'openai' | 'deepseek';

export interface AIEnvironment {
  GEMINI_API_KEY?: string;
  GEMINI_API_KEY_2?: string;
  GEMINI_API_KEY_3?: string;
  GEMINI_API_KEY_4?: string;
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  OPENAI_API_KEY?: string;
  OPENAI_INSTRUMENT_MODEL?: string;
  OPENAI_MODEL?: string;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_MODEL?: string;
  GEMINI_MODEL?: string;
  GEMINI_CHLOE_MODEL?: string;
  GEMINI_VYRA_MODEL?: string;
  GEMINI_INSTRUMENT_MODEL?: string;
  GEMINI_ECONOMIC_MODEL?: string;
}

export type AICallOverrides = Pick<
  GeminiRequestOptions,
  'systemInstruction' | 'temperature' | 'maxTokens' | 'responseJson' | 'timeoutMs' | 'globalTimeoutMs' | 'fallbackModels'
>;

interface AssistantConfig {
  model: (env: AIEnvironment) => string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  globalTimeoutMs: number;
}

const ASSISTANT_CONFIG: Record<AIAssistantId, AssistantConfig> = {
  chloe: {
    model: env => env.GEMINI_CHLOE_MODEL?.trim() || 'gemini-3.5-flash-lite',
    temperature: 0.2,
    maxTokens: 1000,
    timeoutMs: 20000,
    globalTimeoutMs: 45000,
  },
  vyra: {
    model: env => env.GEMINI_VYRA_MODEL?.trim() || env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite',
    temperature: 0.3,
    maxTokens: 1200,
    timeoutMs: 15000,
    globalTimeoutMs: 45000,
  },
  'instrument-suggest': {
    model: env => env.GEMINI_INSTRUMENT_MODEL?.trim() || env.GEMINI_CHLOE_MODEL?.trim() || env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash',
    temperature: 0.1,
    maxTokens: 300,
    timeoutMs: 12000,
    globalTimeoutMs: 20000,
  },
  'economic-calendar-analysis': {
    model: env => env.GEMINI_ECONOMIC_MODEL?.trim() || env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite',
    temperature: 0.2,
    maxTokens: 500,
    timeoutMs: 12000,
    globalTimeoutMs: 16000,
  },
};

export function isGeminiConfigured(env: AIEnvironment): boolean {
  return [env.GEMINI_API_KEY, env.GEMINI_API_KEY_2, env.GEMINI_API_KEY_3, env.GEMINI_API_KEY_4]
    .some(key => Boolean(key?.trim()));
}

export function isInstrumentAIConfigured(env: AIEnvironment): boolean {
  return isGeminiConfigured(env) || Boolean(env.OPENAI_API_KEY?.trim()) || Boolean(env.DEEPSEEK_API_KEY?.trim());
}

type CompatibleProvider = 'openai' | 'deepseek';

function toCompatibleMessages(contents: unknown, systemInstruction?: string): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (systemInstruction?.trim()) messages.push({ role: 'system', content: systemInstruction });
  if (typeof contents === 'string') {
    messages.push({ role: 'user', content: contents });
    return messages;
  }
  if (!Array.isArray(contents)) {
    messages.push({ role: 'user', content: JSON.stringify(contents) });
    return messages;
  }
  for (const item of contents as Array<{ role?: string; parts?: Array<{ text?: string }> }>) {
    const content = (item.parts || []).map(part => typeof part.text === 'string' ? part.text : '').filter(Boolean).join('\\n').trim();
    if (!content) continue;
    messages.push({ role: item.role === 'model' || item.role === 'assistant' ? 'assistant' : 'user', content });
  }
  return messages;
}

async function callCompatibleProvider(
  provider: CompatibleProvider, contents: unknown, env: AIEnvironment,
  overrides: AICallOverrides, previousError?: string,
): Promise<GeminiResponse> {
  const apiKey = provider === 'openai' ? env.OPENAI_API_KEY?.trim() : env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) return { success: false, error: previousError || `${provider} non configuré.`, errorCategory: 'configuration' };
  const model = provider === 'openai'
    ? env.OPENAI_INSTRUMENT_MODEL?.trim() || env.OPENAI_MODEL?.trim() || 'gpt-4o-mini'
    : env.DEEPSEEK_MODEL?.trim() || 'deepseek-flash';
  const endpoint = provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://api.deepseek.com/chat/completions';
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutMs = Math.max(1000, overrides.globalTimeoutMs ?? 15000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: overrides.temperature ?? 0.2,
        max_tokens: overrides.maxTokens ?? 800,
        ...(overrides.responseJson ? { response_format: { type: 'json_object' } } : {}),
        messages: toCompatibleMessages(contents, overrides.systemInstruction),
      }),
      signal: controller.signal,
    });
    const raw = await response.text();
    if (!response.ok) {
      let message = `${provider} HTTP ${response.status}`;
      try { message = (JSON.parse(raw) as { error?: { message?: string } }).error?.message || message; } catch { /* keep status */ }
      const category = response.status === 429 ? 'rate_limit' : response.status >= 500 ? 'provider_error' : response.status === 401 || response.status === 403 ? 'authentication_or_billing' : 'provider_error';
      console.warn('[IAMTRADER_AI] Compatible provider failed:', { provider, model, status: response.status, category, latencyMs: Date.now() - startedAt });
      return { success: false, error: message, httpStatus: response.status, modelUsed: model, errorCategory: category, latencyMs: Date.now() - startedAt };
    }
    const data = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string | null } }> };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return { success: false, error: `${provider} a renvoyé une réponse vide.`, errorCategory: 'empty_provider_response', modelUsed: model, latencyMs: Date.now() - startedAt };
    return { success: true, text, modelUsed: model, httpStatus: response.status, keyAlias: provider.toUpperCase() + '_PRIMARY', attempts: 1, failovers: 1, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : `Erreur réseau ${provider}.`, errorCategory: 'network_error', modelUsed: model, latencyMs: Date.now() - startedAt };
  } finally { clearTimeout(timer); }
}

/**
 * Invoke the configured model. OpenAI fallback is intentionally restricted to instrument suggestions;
 * other assistants retain their Gemini-only behavior and predictable provider selection.
 */
export async function callAI(
  assistantId: AIAssistantId,
  contents: unknown,
  env: AIEnvironment,
  overrides: AICallOverrides = {},
): Promise<GeminiResponse> {
  const config = ASSISTANT_CONFIG[assistantId];
  const geminiConfigured = isGeminiConfigured(env);
  let result: GeminiResponse = geminiConfigured ? await callGeminiUnified(contents, {
    apiKeys: [env.GEMINI_API_KEY, env.GEMINI_API_KEY_2, env.GEMINI_API_KEY_3, env.GEMINI_API_KEY_4],
    preferredModel: config.model(env),
    fallbackModels: overrides.fallbackModels ?? [],
    temperature: overrides.temperature ?? config.temperature,
    maxTokens: overrides.maxTokens ?? config.maxTokens,
    timeoutMs: overrides.timeoutMs ?? config.timeoutMs,
    globalTimeoutMs: overrides.globalTimeoutMs ?? config.globalTimeoutMs,
    systemInstruction: overrides.systemInstruction,
    responseJson: overrides.responseJson,
  }) : { success: false, error: 'Gemini non configuré.', errorCategory: 'configuration' };

  // Keep Gemini first. OpenAI and DeepSeek are independent fallbacks for every assistant.
  if (!result.success && env.OPENAI_API_KEY?.trim()) {
    const openAIResult = await callCompatibleProvider('openai', contents, env, overrides, result.error);
    if (openAIResult.success) result = openAIResult;
    else result = { ...openAIResult, error: openAIResult.error || result.error };
  }
  if (!result.success && env.DEEPSEEK_API_KEY?.trim()) {
    const deepSeekResult = await callCompatibleProvider('deepseek', contents, env, overrides, result.error);
    if (deepSeekResult.success) result = deepSeekResult;
    else result = { ...deepSeekResult, error: deepSeekResult.error || result.error };
  }
  const provider: AIProvider = result.keyAlias === 'OPENAI_PRIMARY' ? 'openai' : result.keyAlias === 'DEEPSEEK_PRIMARY' ? 'deepseek' : 'gemini';
  const telemetry = {
    assistant: assistantId, provider, model: result.modelUsed || config.model(env),
    keyAlias: result.keyAlias || null, status: result.httpStatus || null,
    latencyMs: result.latencyMs || 0, attempts: result.attempts || 0,
    failovers: result.failovers || 0, outcome: result.success ? 'success' : 'failure',
    errorCategory: result.errorCategory || null, createdAt: new Date().toISOString(),
  };
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    await firestoreSet(env, `aiTelemetry/${crypto.randomUUID()}`, telemetry)
      .catch(error => console.warn('[IAMTRADER_AI] Telemetry persistence unavailable:', error instanceof Error ? error.message : 'unknown'));
  }
  console.info('[IAMTRADER_AI]', JSON.stringify({
    event: 'request_completed', assistant: assistantId, provider,
    model: result.modelUsed || config.model(env), keyAlias: result.keyAlias || null,
    status: result.httpStatus || null, latencyMs: result.latencyMs,
    attempts: result.attempts || 0, failovers: result.failovers || 0,
    outcome: result.success ? 'success' : 'failure', errorCategory: result.errorCategory || null,
  }));
  return result;
}
