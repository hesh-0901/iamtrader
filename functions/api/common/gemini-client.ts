export interface GeminiRequestOptions {
  apiKeys?: Array<string | undefined>;
  apiKey?: string;
  preferredModel?: string;
  fallbackModels?: string[];
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  responseJson?: boolean;
  timeoutMs?: number;
  globalTimeoutMs?: number;
}

export interface GeminiResponse {
  success: boolean;
  text?: string;
  error?: string;
  modelUsed?: string;
  httpStatus?: number;
  keyAlias?: string;
  attempts?: number;
  failovers?: number;
  latencyMs?: number;
  errorCategory?: string;
}

const DEFAULT_FALLBACKS = ['gemini-2.5-flash'];
const KEY_COOLDOWN_MS = 60_000;
let nextKeyIndex = 0;
const keyCooldownUntil = new Map<string, number>();

type GeminiErrorPayload = { error?: { message?: string; status?: string; code?: number } };

function extractErrorMessage(raw: string, status: number): string {
  try {
    const parsed = JSON.parse(raw) as GeminiErrorPayload;
    return parsed?.error?.message || parsed?.error?.status || `HTTP ${status}`;
  } catch { return `HTTP ${status}`; }
}

function errorCategory(status: number | undefined, message: string): string {
  if (/timeout|délai dépassé|budget global/i.test(message)) return 'timeout';
  if (status === 429) return 'rate_limit';
  if (status === 401) return 'invalid_key';
  if (status === 403) return 'permission_or_billing';
  if (status === 400) return 'invalid_request';
  if (status === 404) return 'model_not_found';
  if (status && status >= 500) return 'provider_error';
  return 'network_error';
}

/** Gemini server-side client with bounded multi-key failover. Request contents are passed through unchanged. */
export async function callGeminiUnified(
  promptOrContents: unknown,
  options: GeminiRequestOptions,
): Promise<GeminiResponse> {
  const configuredKeys = (options.apiKeys || [options.apiKey])
    .map((value, index) => ({ value: value?.trim(), alias: `KEY_0${index + 1}` }))
    .filter((item): item is { value: string; alias: string } => Boolean(item.value));
  if (!configuredKeys.length) {
    return { success: false, error: 'Aucune clé Gemini n’est configurée.', errorCategory: 'configuration' };
  }

  const models = [...new Set(
    [options.preferredModel?.trim(), ...(options.fallbackModels ?? DEFAULT_FALLBACKS).map(m => m.trim())]
      .filter((model): model is string => Boolean(model)),
  )];
  if (!models.length) return { success: false, error: 'Aucun modèle Gemini configuré.', errorCategory: 'configuration' };

  const contents = typeof promptOrContents === 'string'
    ? [{ role: 'user', parts: [{ text: promptOrContents }] }]
    : promptOrContents;

  const startedAt = Date.now();
  const globalTimeoutMs = Math.max(1000, options.globalTimeoutMs ?? options.timeoutMs ?? 20000);
  const deadline = startedAt + globalTimeoutMs;
  const controller = new AbortController();
  const globalTimer = setTimeout(() => controller.abort(), globalTimeoutMs);
  let lastError = 'Aucune clé Gemini disponible.';
  let lastStatus: number | undefined;
  let lastCategory = 'provider_unavailable';
  let attempts = 0;
  let lastAlias: string | undefined;
  const now = Date.now();
  const rotated = configuredKeys.map((_, offset) => configuredKeys[(nextKeyIndex + offset) % configuredKeys.length]);
  const available = rotated.filter(key => (keyCooldownUntil.get(key.alias) || 0) <= now);
  const keyOrder = available.length ? available : rotated;
  nextKeyIndex = (nextKeyIndex + 1) % configuredKeys.length;

  try {
    for (const key of keyOrder) {
      for (const model of models) {
        const remaining = deadline - Date.now();
        if (remaining <= 0 || controller.signal.aborted) {
          lastError = `Budget global dépassé (${globalTimeoutMs} ms).`;
          lastCategory = 'timeout';
          break;
        }
        attempts += 1;
        lastAlias = key.alias;
        const attemptController = new AbortController();
        const attemptTimeoutMs = Math.min(Math.max(1000, options.timeoutMs ?? 12000), remaining);
        const attemptTimer = setTimeout(() => attemptController.abort(), attemptTimeoutMs);
        try {
          const generationConfig: Record<string, unknown> = {
            temperature: options.temperature ?? 0.2,
            maxOutputTokens: options.maxTokens ?? 800,
          };
          if (options.responseJson) generationConfig.responseMimeType = 'application/json';
          const payload: Record<string, unknown> = { contents, generationConfig };
          if (options.systemInstruction) payload.systemInstruction = { parts: [{ text: options.systemInstruction }] };

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key.value },
              body: JSON.stringify(payload),
              signal: AbortSignal.any([controller.signal, attemptController.signal]),
            },
          );
          const raw = await response.text();
          if (!response.ok) {
            lastStatus = response.status;
            lastError = `Gemini (${model}): ${extractErrorMessage(raw, response.status)}`;
            lastCategory = errorCategory(response.status, lastError);
            if (response.status === 429 || response.status >= 500 || response.status === 401) {
              keyCooldownUntil.set(key.alias, Date.now() + (response.status === 429 ? KEY_COOLDOWN_MS : 15_000));
              break;
            }
            if (response.status === 404 && models.length > 1) continue;
            return { success: false, error: lastError, httpStatus: lastStatus, keyAlias: key.alias, attempts, failovers: attempts - 1, latencyMs: Date.now() - startedAt, errorCategory: lastCategory };
          }

          let data: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
          try { data = raw ? JSON.parse(raw) : {}; }
          catch {
            lastError = `Réponse JSON invalide du modèle ${model}.`;
            lastCategory = 'invalid_provider_response';
            break;
          }
          const text = data.candidates?.[0]?.content?.parts
            ?.map(part => part.text).filter((part): part is string => typeof part === 'string').join('\n').trim();
          if (!text) {
            lastError = `Réponse vide du modèle ${model}.`;
            lastCategory = 'empty_provider_response';
            break;
          }
          return { success: true, text, modelUsed: model, httpStatus: response.status, keyAlias: key.alias, attempts, failovers: attempts - 1, latencyMs: Date.now() - startedAt };
        } catch (error) {
          const timedOut = error instanceof Error && error.name === 'AbortError';
          lastError = timedOut
            ? (controller.signal.aborted ? `Budget global dépassé (${globalTimeoutMs} ms).` : `Délai dépassé (${attemptTimeoutMs} ms) pour le modèle ${model}.`)
            : 'Erreur réseau Gemini.';
          lastCategory = timedOut ? 'timeout' : 'network_error';
          keyCooldownUntil.set(key.alias, Date.now() + 15_000);
          if (controller.signal.aborted) break;
        } finally { clearTimeout(attemptTimer); }
      }
      if (controller.signal.aborted || Date.now() >= deadline) break;
    }
  } finally { clearTimeout(globalTimer); }

  return {
    success: false, error: lastError, httpStatus: lastStatus, keyAlias: lastAlias,
    attempts, failovers: Math.max(0, attempts - 1), latencyMs: Date.now() - startedAt,
    errorCategory: lastCategory,
  };
}
