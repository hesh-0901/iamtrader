export interface GeminiRequestOptions {
  apiKey: string;
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
}

const DEFAULT_FALLBACKS = ['gemini-2.5-flash'];

type GeminiErrorPayload = {
  error?: { message?: string; status?: string; code?: number };
};

function extractErrorMessage(raw: string, status: number): string {
  try {
    const parsed = JSON.parse(raw) as GeminiErrorPayload;
    return parsed?.error?.message || parsed?.error?.status || `HTTP ${status}`;
  } catch {
    return `HTTP ${status}`;
  }
}

function shouldTryFallback(status: number): boolean {
  // Invalid requests and credentials will not be fixed by switching models.
  if ([400, 401, 403].includes(status)) return false;
  return status === 404 || status === 429 || status >= 500;
}

/**
 * Appelle Gemini côté serveur. La clé reste dans l'en-tête et n'est jamais ajoutée à l'URL.
 * Un seul budget temporel couvre toute la chaîne principale + secours.
 */
export async function callGeminiUnified(
  promptOrContents: unknown,
  options: GeminiRequestOptions,
): Promise<GeminiResponse> {
  const apiKey = options.apiKey?.trim();
  if (!apiKey) {
    return { success: false, error: 'GEMINI_API_KEY non configurée dans l’environnement.' };
  }

  const models = [...new Set(
    [options.preferredModel?.trim(), ...(options.fallbackModels ?? DEFAULT_FALLBACKS).map(m => m.trim())]
      .filter((model): model is string => Boolean(model)),
  )];

  if (!models.length) {
    return { success: false, error: 'Aucun modèle Gemini configuré.' };
  }

  const contents = typeof promptOrContents === 'string'
    ? [{ role: 'user', parts: [{ text: promptOrContents }] }]
    : promptOrContents;

  let lastError = 'Aucun modèle Gemini n’a pu répondre.';
  let lastStatus: number | undefined;
  const globalTimeoutMs = Math.max(1000, options.globalTimeoutMs ?? options.timeoutMs ?? 20000);
  const controller = new AbortController();
  const deadline = Date.now() + globalTimeoutMs;
  const timer = setTimeout(() => controller.abort(), globalTimeoutMs);

  try {
  for (const model of models) {
    if (controller.signal.aborted) {
      lastError = `Budget global dépassé (${globalTimeoutMs} ms).`;
      break;
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      lastError = `Budget global dépassé (${globalTimeoutMs} ms).`;
      break;
    }
    const attemptController = new AbortController();
    const attemptTimeoutMs = Math.min(Math.max(1000, options.timeoutMs ?? 12000), remainingMs);
    const attemptTimer = setTimeout(() => attemptController.abort(), attemptTimeoutMs);

    try {
      const generationConfig: Record<string, unknown> = {
        temperature: options.temperature ?? 0.2,
        maxOutputTokens: options.maxTokens ?? 800,
      };
      if (options.responseJson) generationConfig.responseMimeType = 'application/json';

      const payload: Record<string, unknown> = { contents, generationConfig };
      if (options.systemInstruction) {
        payload.systemInstruction = { parts: [{ text: options.systemInstruction }] };
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(payload),
          signal: AbortSignal.any([controller.signal, attemptController.signal]),
        },
      );

      const raw = await response.text();
      if (!response.ok) {
        lastStatus = response.status;
        lastError = `Gemini (${model}): ${extractErrorMessage(raw, response.status)}`;
        console.warn('[GeminiClient] Provider error', { model, status: response.status });
        if (shouldTryFallback(response.status)) continue;
        break;
      }

      let data: {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
          finishReason?: string;
        }>;
        error?: { message?: string };
      };
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        lastError = `Réponse JSON invalide du modèle ${model}.`;
        lastStatus = response.status;
        continue;
      }

      const text = data.candidates?.[0]?.content?.parts
        ?.map(part => part.text)
        .filter((part): part is string => typeof part === 'string')
        .join('\n')
        .trim();

      if (!text) {
        lastError = `Réponse vide du modèle ${model}.`;
        lastStatus = response.status;
        continue;
      }

      return { success: true, text, modelUsed: model, httpStatus: response.status };
    } catch (error) {
      const wasTimeout = error instanceof Error && error.name === 'AbortError';
      lastError = wasTimeout
        ? (controller.signal.aborted
            ? `Budget global dépassé (${globalTimeoutMs} ms) pendant l’appel à ${model}.`
            : `Délai dépassé (${attemptTimeoutMs} ms) pour le modèle ${model}.`)
        : error instanceof Error ? error.message : 'Erreur réseau Gemini inconnue.';
      console.warn('[GeminiClient] Request failed', {
        model,
        reason: wasTimeout ? (controller.signal.aborted ? 'GlobalTimeout' : 'AttemptTimeout') : error instanceof Error ? error.name : 'unknown',
      });
    } finally {
      clearTimeout(attemptTimer);
    }
  }
  } finally {
    clearTimeout(timer);
  }

  return { success: false, error: lastError, httpStatus: lastStatus };
}
