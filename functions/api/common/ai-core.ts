import {
  callGeminiUnified,
  type GeminiRequestOptions,
  type GeminiResponse,
} from './gemini-client';

/**
 * Central AI Core for IAMTRADER.
 *
 * Gemini is the only enabled provider in this release. Assistant identity,
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

export type AIProvider = 'gemini';

export interface AIEnvironment {
  GEMINI_API_KEY?: string;
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
  return callGeminiUnified(contents, {
    apiKey: env.GEMINI_API_KEY || '',
    preferredModel: config.model(env),
    fallbackModels: [],
    temperature: overrides.temperature ?? config.temperature,
    maxTokens: overrides.maxTokens ?? config.maxTokens,
    timeoutMs: overrides.timeoutMs ?? config.timeoutMs,
    globalTimeoutMs: overrides.globalTimeoutMs ?? config.globalTimeoutMs,
    systemInstruction: overrides.systemInstruction,
    responseJson: overrides.responseJson,
  });
}
