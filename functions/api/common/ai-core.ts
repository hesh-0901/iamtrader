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

export type AIProvider = 'gemini' | 'openai';

export interface AIEnvironment {
  GEMINI_API_KEY?: string;
  GEMINI_API_KEY_2?: string;
  GEMINI_API_KEY_3?: string;
  GEMINI_API_KEY_4?: string;
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  OPENAI_API_KEY?: string;
  OPENAI_INSTRUMENT_MODEL?: string;
  GEMINI_MODEL?: string;
  GEMINI_CHLOE_MODEL?: string;
  GEMINI_VYRA_MODEL?: string;
  GEMINI_INSTRUMENT_MODEL?: string;
  GEMINI_ECONOMIC_MODEL?: string;
}

export type AICallOverrides = Pick<
  GeminiRequestOptions,
  'systemInstruction' | 'temperature' | 'maxTokens' | 'responseJson' | 'timeoutMs' | 'globalTimeoutMs'
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
    timeoutMs: 6500,
    globalTimeoutMs: 16000,
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
  return isGeminiConfigured(env) || Boolean(env.OPENAI_API_KEY?.trim());
}

async function callOpenAIInstrumentFallback(
  contents: unknown, env: AIEnvironment, overrides: AICallOverrides, previousError?: string,
): Promise<GeminiResponse> {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { success: false, error: previousError || 'Aucun fournisseur IA configuré.', errorCategory: 'configuration' };
  const prompt = typeof contents === 'string' ? contents : JSON.stringify(contents);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, overrides.globalTimeoutMs ?? 12000));
  const startedAt = Date.now();
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.OPENAI_INSTRUMENT_MODEL?.trim() || 'gpt-4o-mini',
        temperature: overrides.temperature ?? 0.1,
        max_tokens: overrides.maxTokens ?? 500,
        response_format: overrides.responseJson ? { type: 'json_object' } : undefined,
        messages: [
          ...(overrides.systemInstruction ? [{ role: 'system', content: overrides.systemInstruction }] : []),
          { role: 'user', content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    const raw = await response.text();
    if (!response.ok) {
      let message = `OpenAI HTTP ${response.status}`;
      try { message = (JSON.parse(raw) as { error?: { message?: string } }).error?.message || message; } catch { /* keep status */ }
      return { success: false, error: message, httpStatus: response.status, modelUsed: env.OPENAI_INSTRUMENT_MODEL || 'gpt-4o-mini', errorCategory: response.status === 429 ? 'rate_limit' : response.status >= 500 ? 'provider_error' : 'openai_error', latencyMs: Date.now() - startedAt };
    }
    const data = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string | null } }> };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return { success: false, error: 'OpenAI a renvoyé une réponse vide.', errorCategory: 'empty_provider_response', latencyMs: Date.now() - startedAt };
    return { success: true, text, modelUsed: env.OPENAI_INSTRUMENT_MODEL || 'gpt-4o-mini', httpStatus: response.status, keyAlias: 'OPENAI_PRIMARY', attempts: 1, failovers: 1, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau OpenAI.', errorCategory: 'network_error', latencyMs: Date.now() - startedAt };
  } finally { clearTimeout(timer); }
}

/**
 * Invoke the configured model for one IAMTRADER assistant.
 * No automatic provider switch, paid-provider fallback or implicit model
 * fallback is performed. This keeps API spend predictable and errors visible.
 */
export async function callAI(
  assistantId: AIAssistantId,
  contents: unknown,
  env: AIEnvironment,
  overrides: AICallOverrides = {},
): Promise<GeminiResponse> {
  const config = ASSISTANT_CONFIG[assistantId];
  const geminiConfigured = isGeminiConfigured(env);
  const geminiResult = geminiConfigured ? await callGeminiUnified(contents, {
    apiKeys: [env.GEMINI_API_KEY, env.GEMINI_API_KEY_2, env.GEMINI_API_KEY_3, env.GEMINI_API_KEY_4],
    preferredModel: config.model(env),
    fallbackModels: [],
    temperature: overrides.temperature ?? config.temperature,
    maxTokens: overrides.maxTokens ?? config.maxTokens,
    timeoutMs: overrides.timeoutMs ?? config.timeoutMs,
    globalTimeoutMs: overrides.globalTimeoutMs ?? config.globalTimeoutMs,
    systemInstruction: overrides.systemInstruction,
    responseJson: overrides.responseJson,
  }) : { success: false, error: 'Gemini non configuré.', errorCategory: 'configuration' } as GeminiResponse;
  const result = assistantId === 'instrument-suggest' && !geminiResult.success && env.OPENAI_API_KEY?.trim()
    ? await callOpenAIInstrumentFallback(contents, env, overrides, geminiResult.error)
    : geminiResult;
  const provider: AIProvider = result.keyAlias === 'OPENAI_PRIMARY' ? 'openai' : 'gemini';
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
