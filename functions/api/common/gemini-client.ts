export interface GeminiRequestOptions {
  apiKey: string;
  preferredModel?: string;
  fallbackModels?: string[];
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  responseJson?: boolean;
  timeoutMs?: number;
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

function shouldRetry(status: number): boolean {
  return [400, 404, 408, 429, 500, 502, 503, 504].includes(status);
}

/**
 * Appelle Gemini côté serveur. La clé reste dans l'en-tête et n'est jamais ajoutée à l'URL.
 * Chaque tentative est bornée et toutes les erreurs réseau/JSON sont capturées.
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

  for (const model of models) {
    const controller = new AbortController();
    const timeoutMs = Math.max(1000, options.timeoutMs ?? 7000);
    const timer = setTimeout(() => controller.abort(), timeoutMs);

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
          signal: controller.signal,
        },
      );

      const raw = await response.text();
      if (!response.ok) {
        lastStatus = response.status;
        lastError = `Gemini (${model}): ${extractErrorMessage(raw, response.status)}`;
        console.warn('[GeminiClient] Provider error', { model, status: response.status });
        if (shouldRetry(response.status)) continue;
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
      lastError = error instanceof Error && error.name === 'AbortError'
        ? `Timeout de ${timeoutMs} ms pour ${model}.`
        : error instanceof Error ? error.message : 'Erreur réseau Gemini inconnue.';
      console.warn('[GeminiClient] Request failed', {
        model,
        reason: error instanceof Error ? error.name : 'unknown',
      });
    } finally {
      clearTimeout(timer);
    }
  }

  return { success: false, error: lastError, httpStatus: lastStatus };
}
