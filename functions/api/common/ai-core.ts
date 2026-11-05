import {
  callGeminiUnified,
  type GeminiRequestOptions,
  type GeminiResponse,
} from './gemini-client';
import { firestoreGet, firestoreSet } from '../../../worker/firebaseAdmin';

/**
 * Central AI Core for IAMTRADER.
 *
 * Central provider orchestration for every IAMTRADER assistant.
 * Gemini is primary, followed by OpenAI and DeepSeek within one shared timeout budget.
 * Assistant identity, prompts, validation and HTTP contracts remain in route handlers.
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

export type AICallOverrides = Pick<GeminiRequestOptions, 'systemInstruction' | 'responseJson'>;

interface AssistantConfig {
  model: (env: AIEnvironment) => string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  globalTimeoutMs: number;
  enabled?: boolean;
  providerOrder?: AIProvider[];
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

export function isAIConfigured(env: AIEnvironment): boolean {
  return isGeminiConfigured(env) || Boolean(env.OPENAI_API_KEY?.trim()) || Boolean(env.DEEPSEEK_API_KEY?.trim());
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
    const content = (item.parts || []).map(part => typeof part.text === 'string' ? part.text : '').filter(Boolean).join('\n').trim();
    if (!content) continue;
    messages.push({ role: item.role === 'model' || item.role === 'assistant' ? 'assistant' : 'user', content });
  }
  return messages;
}

async function callCompatibleProvider(
  provider: CompatibleProvider, contents: unknown, env: AIEnvironment,
  overrides: AICallOverrides & { temperature: number; maxTokens: number; globalTimeoutMs: number }, previousError?: string, providerModel?: string,
): Promise<GeminiResponse> {
  const apiKey = provider === 'openai' ? env.OPENAI_API_KEY?.trim() : env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) return { success: false, error: previousError || `${provider} non configuré.`, errorCategory: 'configuration' };
  const model = provider === 'openai'
    ? providerModel || env.OPENAI_INSTRUMENT_MODEL?.trim() || env.OPENAI_MODEL?.trim() || 'gpt-4o-mini'
    : providerModel || env.DEEPSEEK_MODEL?.trim() || 'deepseek-flash';
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
      const retryAfter = response.headers.get('retry-after');
      const retryAfterMs = retryAfter ? (Number.isFinite(Number(retryAfter)) ? Number(retryAfter) * 1000 : Math.max(0, Date.parse(retryAfter) - Date.now())) : undefined;
      return { success: false, error: message, httpStatus: response.status, modelUsed: model, keyAlias: provider.toUpperCase() + '_PRIMARY', attempts: 1, errorCategory: category, retryAfterMs, latencyMs: Date.now() - startedAt };
    }
    const data = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string | null } }> };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return { success: false, error: `${provider} a renvoyé une réponse vide.`, errorCategory: 'empty_provider_response', modelUsed: model, keyAlias: provider.toUpperCase() + '_PRIMARY', attempts: 1, latencyMs: Date.now() - startedAt };
    return { success: true, text, modelUsed: model, httpStatus: response.status, keyAlias: provider.toUpperCase() + '_PRIMARY', attempts: 1, failovers: 0, latencyMs: Date.now() - startedAt };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    return { success: false, error: timedOut ? `Délai dépassé pour ${provider}.` : error instanceof Error ? error.message : `Erreur réseau ${provider}.`, errorCategory: timedOut ? 'timeout' : 'network_error', modelUsed: model, keyAlias: provider.toUpperCase() + '_PRIMARY', attempts: 1, latencyMs: Date.now() - startedAt };
  } finally { clearTimeout(timer); }
}

/**
 * Invoke the configured provider chain for any assistant while preserving a single
 * end-to-end timeout budget. Non-text Gemini payloads are not sent to incompatible
 * providers, preventing silent loss of images, audio or document content.
 */
export async function callAI(
  assistantId: AIAssistantId,
  contents: unknown,
  env: AIEnvironment,
  overrides: AICallOverrides = {},
): Promise<GeminiResponse> {
  const baseConfig = ASSISTANT_CONFIG[assistantId];
  let managed: Record<string, any> | undefined;
  let configSource: 'firestore' | 'defaults' = 'defaults';
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()) return { success: false, error: 'Configuration dynamique indisponible : accès Firestore non configuré.', errorCategory: 'configuration_unavailable' };
  try {
    const saved = await firestoreGet(env, 'system/aiEngineConfig');
    managed = Array.isArray(saved?.assistants) ? saved.assistants.find((item: any) => item.id === assistantId) : undefined;
    if (saved && !managed) return { success: false, error: `Configuration Firestore manquante pour l’assistant ${assistantId}.`, errorCategory: 'configuration_incomplete' };
    if (managed) configSource = 'firestore';
  } catch (error) {
    console.error('[IAMTRADER_AI] Dynamic configuration read failed; request blocked:', error instanceof Error ? error.message : 'unknown');
    return { success: false, error: 'Impossible de charger la configuration IA active depuis Firestore.', errorCategory: 'configuration_unavailable' };
  }
  if (managed) {
    const allowedProviders: AIProvider[] = ['gemini', 'openai', 'deepseek'];
    const order = Array.isArray(managed.providerOrder) ? managed.providerOrder : [];
    const temperature = Number(managed.temperature);
    const maxTokens = Number(managed.maxTokens);
    const timeoutMs = Number(managed.timeoutMs);
    if (order.length !== allowedProviders.length || new Set(order).size !== allowedProviders.length || order.some((provider: unknown) => !allowedProviders.includes(provider as AIProvider)) ||
        !Number.isFinite(temperature) || temperature < 0 || temperature > 2 ||
        !Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 8192 ||
        !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) {
      return { success: false, error: `Configuration Firestore invalide pour l’assistant ${assistantId}.`, errorCategory: 'configuration_invalid' };
    }
  }
  const config: AssistantConfig = {
    ...baseConfig,
    ...(managed ? {
      enabled: managed.enabled !== false,
      providerOrder: Array.isArray(managed.providerOrder) ? managed.providerOrder.filter((value: unknown): value is AIProvider => ['gemini','openai','deepseek'].includes(String(value))) : undefined,
      model: () => typeof managed.models?.gemini === 'string' && managed.models.gemini.trim() ? managed.models.gemini.trim() : typeof managed.model === 'string' && managed.model.trim() ? managed.model.trim() : baseConfig.model(env),
      temperature: Number.isFinite(Number(managed.temperature)) ? Number(managed.temperature) : baseConfig.temperature,
      maxTokens: Number.isFinite(Number(managed.maxTokens)) ? Number(managed.maxTokens) : baseConfig.maxTokens,
      timeoutMs: Number.isFinite(Number(managed.timeoutMs)) ? Number(managed.timeoutMs) : baseConfig.timeoutMs,
    } : {}),
  };
  const startedAt = Date.now();
  const totalBudgetMs = Math.max(1000, Math.min(60000, config.timeoutMs || baseConfig.timeoutMs));
  const deadline = startedAt + totalBudgetMs;
  const canUseTextFallback = typeof contents === 'string' || (
    Array.isArray(contents) && contents.every(item =>
      item && Array.isArray((item as { parts?: unknown }).parts) &&
      ((item as { parts: unknown[] }).parts).every(part =>
        part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string'
      )
    )
  );
  const providerOrder = config.providerOrder?.length ? config.providerOrder : ['gemini', 'openai', 'deepseek'];
  let result: GeminiResponse = { success: false, error: 'Aucun fournisseur IA disponible.', errorCategory: 'configuration' };
  let attempted = 0;
  let totalAttempts = 0;
  let totalFailovers = 0;
  let lastProvider: AIProvider | 'none' = 'none';
  const providerTrace: Array<{ provider: AIProvider; model: string; status: number | null; category: string | null; message?: string }> = [];
  if (config.enabled === false) {
    result = { success: false, error: 'Cet assistant est désactivé depuis le moteur IA.', errorCategory: 'assistant_disabled' };
  } else {
    for (let index = 0; index < providerOrder.length; index += 1) {
      const provider = providerOrder[index];
      const remaining = deadline - Date.now();
      if (remaining <= 1000) break;
      const remainingProviders = providerOrder.length - index;
      const attemptBudget = Math.max(1000, Math.floor(remaining / remainingProviders));
      let attempt: GeminiResponse;
      if (provider === 'gemini') {
        if (!isGeminiConfigured(env)) {
          providerTrace.push({ provider, model: config.model(env), status: null, category: 'configuration_missing', message: 'Aucune clé Gemini configurée.' });
          continue;
        }
        lastProvider = provider;
        attempt = await callGeminiUnified(contents, {
          apiKeys: [env.GEMINI_API_KEY, env.GEMINI_API_KEY_2, env.GEMINI_API_KEY_3, env.GEMINI_API_KEY_4],
          preferredModel: config.model(env),
          fallbackModels: [], temperature: config.temperature, maxTokens: config.maxTokens,
          timeoutMs: attemptBudget, globalTimeoutMs: attemptBudget,
          systemInstruction: overrides.systemInstruction,
          responseJson: overrides.responseJson,
        });
      } else {
        if (!canUseTextFallback) {
          attempt = { success: false, error: 'Contenu multimodal incompatible avec le fournisseur de secours.', errorCategory: 'fallback_payload_unsupported' };
          providerTrace.push({ provider, model: provider === 'openai' ? String(managed?.models?.openai || env.OPENAI_MODEL || 'gpt-4o-mini') : String(managed?.models?.deepseek || env.DEEPSEEK_MODEL || 'deepseek-flash'), status: null, category: attempt.errorCategory, message: attempt.error });
        } else if (provider === 'openai' && env.OPENAI_API_KEY?.trim()) {
          lastProvider = provider;
          attempt = await callCompatibleProvider('openai', contents, env, {
            ...overrides, temperature: config.temperature, maxTokens: config.maxTokens, globalTimeoutMs: attemptBudget,
          }, result.error, typeof managed?.models?.openai === 'string' ? managed.models.openai : undefined);
        } else if (provider === 'deepseek' && env.DEEPSEEK_API_KEY?.trim()) {
          lastProvider = provider;
          attempt = await callCompatibleProvider('deepseek', contents, env, {
            ...overrides, temperature: config.temperature,
            maxTokens: config.maxTokens, globalTimeoutMs: attemptBudget,
          }, result.error, typeof managed?.models?.deepseek === 'string' ? managed.models.deepseek : undefined);
        } else {
          providerTrace.push({ provider, model: provider === 'openai' ? String(managed?.models?.openai || env.OPENAI_MODEL || 'gpt-4o-mini') : String(managed?.models?.deepseek || env.DEEPSEEK_MODEL || 'deepseek-flash'), status: null, category: 'configuration_missing', message: `Clé API ${provider} absente.` });
          continue;
        }
      }
      attempted += 1;
      if (!(provider === 'openai' || provider === 'deepseek') || canUseTextFallback) {
        providerTrace.push({ provider, model: attempt.modelUsed || (provider === 'gemini' ? config.model(env) : provider === 'openai' ? String(managed?.models?.openai || env.OPENAI_MODEL || 'gpt-4o-mini') : String(managed?.models?.deepseek || env.DEEPSEEK_MODEL || 'deepseek-flash')), status: attempt.httpStatus || null, category: attempt.errorCategory || null, ...(attempt.error ? { message: attempt.error.slice(0, 500) } : {}) });
      }
      totalAttempts += Math.max(1, attempt.attempts || 1);
      totalFailovers += Math.max(0, attempt.failovers || 0);
      if (attempt.success) {
        result = { ...attempt, attempts: totalAttempts, failovers: totalFailovers + attempted - 1 };
        break;
      }
      result = attempt;
    }
  }
  const provider = result.keyAlias === 'OPENAI_PRIMARY' ? 'openai' : result.keyAlias === 'DEEPSEEK_PRIMARY' ? 'deepseek' : lastProvider;
  if (attempted > 0) result = { ...result, attempts: totalAttempts, failovers: totalFailovers + Math.max(0, attempted - 1) };
  const telemetry = {
    assistant: assistantId, provider, model: result.modelUsed || (provider === 'openai' ? managed?.models?.openai : provider === 'deepseek' ? managed?.models?.deepseek : config.model(env)) || 'unknown', configSource,
    keyAlias: result.keyAlias || null, status: result.httpStatus || null,
    latencyMs: result.latencyMs || 0, attempts: totalAttempts || result.attempts || 0,
    failovers: totalFailovers + Math.max(0, attempted - 1) || result.failovers || 0, outcome: result.success ? 'success' : 'failure',
    errorCategory: result.errorCategory || null, errorMessage: result.error || null, retryAfterMs: result.retryAfterMs || null, providerOrder, providerTrace, createdAt: new Date().toISOString(),
  };
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    await firestoreSet(env, `aiTelemetry/${crypto.randomUUID()}`, telemetry)
      .catch(error => console.warn('[IAMTRADER_AI] Telemetry persistence unavailable:', error instanceof Error ? error.message : 'unknown'));
  }
  console.info('[IAMTRADER_AI]', JSON.stringify({
    event: 'request_completed', assistant: assistantId, provider, configSource,
    model: result.modelUsed || (provider === 'openai' ? managed?.models?.openai : provider === 'deepseek' ? managed?.models?.deepseek : config.model(env)) || 'unknown', keyAlias: result.keyAlias || null,
    status: result.httpStatus || null, latencyMs: result.latencyMs,
    attempts: totalAttempts || result.attempts || 0, failovers: totalFailovers + Math.max(0, attempted - 1) || result.failovers || 0,
    outcome: result.success ? 'success' : 'failure', errorCategory: result.errorCategory || null, errorMessage: result.error || null, retryAfterMs: result.retryAfterMs || null, providerOrder, providerTrace,
  }));
  return result;
}
