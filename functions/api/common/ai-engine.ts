import { callGeminiUnified } from './gemini-client';

export type AIAssistantId = 'vyra' | 'instrument-suggest' | 'economic-calendar-analysis';
export type AIProvider = 'gemini' | 'openai';

export interface AIEnv {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  AI_PRIMARY_PROVIDER?: string;
}

interface AssistantConfig {
  geminiModel: string;
  openaiModel: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  globalTimeoutMs: number;
}

const ASSISTANTS: Record<AIAssistantId, AssistantConfig> = {
  vyra: {
    geminiModel: 'gemini-3.8-flash',
    openaiModel: 'gpt-4.1-mini',
    temperature: 0.3,
    maxTokens: 1200,
    timeoutMs: 6500,
    globalTimeoutMs: 16000,
  },
  'instrument-suggest': {
    geminiModel: 'gemini-3.8-flash',
    openaiModel: 'gpt-4.1-mini',
    temperature: 0.1,
    maxTokens: 300,
    timeoutMs: 12000,
    globalTimeoutMs: 20000,
  },
  'economic-calendar-analysis': {
    geminiModel: 'gemini-3.8-flash',
    openaiModel: 'gpt-4.1-mini',
    temperature: 0.2,
    maxTokens: 500,
    timeoutMs: 12000,
    globalTimeoutMs: 20000,
  },
};

export interface AIRequestOptions {
  assistant: AIAssistantId;
  env: AIEnv;
  contents: unknown;
  systemInstruction?: string;
  responseJson?: boolean;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  globalTimeoutMs?: number;
}

export interface AIResponse {
  success: boolean;
  text?: string;
  error?: string;
  providerUsed?: AIProvider;
  modelUsed?: string;
  httpStatus?: number;
}

type GeminiContent = {
  role?: string;
  parts?: Array<{ text?: string; inlineData?: unknown; [key: string]: unknown }>;
};

function toOpenAIMessages(contents: unknown, systemInstruction?: string): Array<{ role: string; content: string }> | null {
  const messages: Array<{ role: string; content: string }> = [];
  if (typeof contents === 'string') {
    if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
    messages.push({ role: 'user', content: contents });
    return messages;
  }
  if (!Array.isArray(contents)) return null;
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });

  for (const item of contents as GeminiContent[]) {
    if (!item || !Array.isArray(item.parts)) return null;
    // The text adapter deliberately rejects multimodal payloads rather than silently dropping attachments.
    if (item.parts.some(part => !part || typeof part.text !== 'string' || Object.keys(part).some(key => key !== 'text'))) return null;
    const content = item.parts.map(part => part.text || '').join('\n').trim();
    if (!content) continue;
    messages.push({ role: item.role === 'model' || item.role === 'assistant' ? 'assistant' : 'user', content });
  }
  return messages.length ? messages : null;
}

async function callOpenAI(
  contents: unknown,
  options: AIRequestOptions,
  model: string,
): Promise<AIResponse> {
  const apiKey = options.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { success: false, error: 'OPENAI_API_KEY non configurée.' };

  const messages = toOpenAIMessages(contents, options.systemInstruction);
  if (!messages) return { success: false, error: 'Le fournisseur OpenAI ne prend pas en charge ce contenu (format multimodal ou invalide).' };

  const controller = new AbortController();
  const timeoutMs = Math.max(1000, options.timeoutMs ?? ASSISTANTS[options.assistant].timeoutMs);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? ASSISTANTS[options.assistant].temperature,
        max_tokens: options.maxTokens ?? ASSISTANTS[options.assistant].maxTokens,
        ...(options.responseJson ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    });
    const raw = await response.text();
    if (!response.ok) {
      let message = raw.slice(0, 500);
      try {
        const parsed = JSON.parse(raw) as { error?: { message?: string } };
        message = parsed.error?.message || message;
      } catch { /* Keep the bounded raw provider response. */ }
      return { success: false, error: 'OpenAI (' + model + '): ' + message, httpStatus: response.status };
    }

    const data = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text
      ? { success: true, text, providerUsed: 'openai', modelUsed: model, httpStatus: response.status }
      : { success: false, error: 'Réponse vide du modèle OpenAI.', httpStatus: response.status };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
    return { success: false, error: timedOut ? 'Délai dépassé pour OpenAI (' + timeoutMs + ' ms).' : error instanceof Error ? error.message : 'Erreur réseau OpenAI inconnue.' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Point d'entrée commun des assistants textuels IAMTRADER.
 * Gemini reste prioritaire par défaut ; OpenAI sert de secours si sa clé est configurée.
 * Les contenus multimodaux sont refusés par l'adaptateur OpenAI afin de ne jamais perdre de pièces jointes.
 */
export async function callAI(options: AIRequestOptions): Promise<AIResponse> {
  const config = ASSISTANTS[options.assistant];
  const primary = options.env.AI_PRIMARY_PROVIDER?.trim().toLowerCase() === 'openai' ? 'openai' : 'gemini';
  const providers: AIProvider[] = primary === 'openai' ? ['openai', 'gemini'] : ['gemini', 'openai'];
  let last: AIResponse = { success: false, error: 'Aucun fournisseur IA configuré.' };

  for (const provider of providers) {
    if (provider === 'gemini') {
      if (!options.env.GEMINI_API_KEY?.trim()) {
        last = { success: false, error: 'GEMINI_API_KEY non configurée.' };
        continue;
      }
      const result = await callGeminiUnified(options.contents, {
        apiKey: options.env.GEMINI_API_KEY,
        preferredModel: options.env.GEMINI_MODEL?.trim() || config.geminiModel,
        fallbackModels: [],
        systemInstruction: options.systemInstruction,
        temperature: options.temperature ?? config.temperature,
        maxTokens: options.maxTokens ?? config.maxTokens,
        responseJson: options.responseJson,
        timeoutMs: options.timeoutMs ?? config.timeoutMs,
        globalTimeoutMs: options.globalTimeoutMs ?? config.globalTimeoutMs,
      });
      if (result.success && result.text) {
        return { success: true, text: result.text, providerUsed: 'gemini', modelUsed: result.modelUsed, httpStatus: result.httpStatus };
      }
      last = { success: false, error: result.error, providerUsed: 'gemini', modelUsed: result.modelUsed, httpStatus: result.httpStatus };
      console.warn('[AIEngine] Gemini failed', { assistant: options.assistant, status: result.httpStatus });
      continue;
    }

    if (!options.env.OPENAI_API_KEY?.trim()) {
      last = { success: false, error: 'OPENAI_API_KEY non configurée.', providerUsed: 'openai' };
      continue;
    }
    const result = await callOpenAI(
      options.contents,
      options,
      options.env.OPENAI_MODEL?.trim() || config.openaiModel,
    );
    if (result.success) return result;
    last = result;
    console.warn('[AIEngine] OpenAI failed', { assistant: options.assistant, status: result.httpStatus });
  }

  return last;
}
