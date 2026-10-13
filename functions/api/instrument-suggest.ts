import { callGeminiUnified } from './common/gemini-client';

interface Env {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GEMINI_CHLOE_MODEL?: string;
}

const categories = ['forex', 'metal', 'index', 'futures', 'crypto', 'stock', 'other'] as const;
type Category = typeof categories[number];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function positiveNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export async function onRequest(context: { request: Request; env: Env }) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        Allow: 'POST, OPTIONS',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  let body: { symbol?: unknown; accountCurrency?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return json({ error: 'Requête invalide.' }, 400);
  }

  const symbol = typeof body.symbol === 'string' ? body.symbol.trim().toUpperCase() : '';
  const accountCurrency =
    typeof body.accountCurrency === 'string' && /^[A-Z]{3}$/.test(body.accountCurrency.toUpperCase())
      ? body.accountCurrency.toUpperCase()
      : 'USD';

  if (!symbol || symbol.length > 24 || !/^[A-Z0-9._-]+$/.test(symbol)) {
    return json({ error: 'Saisissez un symbole valide (ex. XAUUSD ou EURUSD).' }, 400);
  }

  if (!env.GEMINI_API_KEY?.trim()) {
    return json({
      error: 'Chloé est temporairement indisponible. Vous pouvez compléter l’instrument manuellement.',
      requiresReview: true,
    });
  }

  const prompt = `Tu aides à configurer un instrument de trading dans IAMTRADER. Retourne exclusivement un objet JSON, sans markdown, avec ces clés : symbol, name, category, priceStep, valuePerPriceUnit, defaultPositionSize, note.
Symbole saisi : ${symbol}
Devise du compte : ${accountCurrency}
category doit être l'une de : ${categories.join(', ')}.
priceStep est le plus petit incrément de cotation habituel (par exemple 0.01 pour XAUUSD ou 0.0001 pour la plupart des paires Forex).
valuePerPriceUnit est le gain/perte approximatif, dans la devise du compte indiquée, pour un mouvement de prix de 1.00 et une unité de taille de position, selon un contrat standard courant. defaultPositionSize doit être 1.
Fais une proposition pratique à partir des spécifications usuelles connues. N'invente pas une certitude : le contrat, la taille de lot et la valeur peuvent varier selon le broker, notamment pour les CFD, indices, futures et paires dont la devise de cotation diffère de celle du compte. Explique brièvement cette réserve dans note. Ne prétends pas avoir consulté le broker de l'utilisateur. Si l'actif est inconnu, utilise category "other", name égal au symbole, priceStep 0.01 et valuePerPriceUnit 1 comme valeurs provisoires clairement signalées dans note.
Tous les nombres doivent être strictement positifs.`;

  const configuredModel = (env.GEMINI_CHLOE_MODEL || env.GEMINI_MODEL || '').trim();
  const result = await callGeminiUnified(prompt, {
    apiKey: env.GEMINI_API_KEY,
    preferredModel: 'gemini-3.5-flash-lite',
    fallbackModels: ['gemini-3.8-flash'],
    responseJson: true,
    temperature: 0.1,
    maxTokens: 300,
    timeoutMs: 6000,
  });

  if (!result.success || !result.text) {
    console.warn('[InstrumentSuggest] Gemini unavailable', {
      model: result.modelUsed,
      status: result.httpStatus,
    });
    return json({
      error: 'Chloé ne peut pas suggérer cet instrument pour le moment. Vous pouvez le compléter manuellement.',
      details: result.error,
      requiresReview: true,
    });
  }

  let suggestion: Record<string, unknown>;
  try {
    const clean = result.text.replace(/```json/gi, '').replace(/```/g, '').trim();
    suggestion = JSON.parse(clean) as Record<string, unknown>;
  } catch {
    return json({
      error: 'La suggestion de Chloé était illisible. Vous pouvez compléter l’instrument manuellement.',
      requiresReview: true,
    });
  }

  const category: Category = categories.includes(suggestion.category as Category)
    ? suggestion.category as Category
    : 'other';
  const priceStep = positiveNumber(suggestion.priceStep);
  const valuePerPriceUnit = positiveNumber(suggestion.valuePerPriceUnit);
  const defaultPositionSize = positiveNumber(suggestion.defaultPositionSize) ?? 1;

  if (!priceStep || !valuePerPriceUnit) {
    return json({
      error: 'Les paramètres proposés sont incomplets. Veuillez vérifier les spécifications auprès de votre broker.',
      requiresReview: true,
    });
  }

  return json({
    instrument: {
      symbol,
      name: typeof suggestion.name === 'string' && suggestion.name.trim()
        ? suggestion.name.trim().slice(0, 80)
        : symbol,
      category,
      priceStep,
      valuePerPriceUnit,
      defaultPositionSize,
    },
    note: typeof suggestion.note === 'string'
      ? suggestion.note.trim().slice(0, 500)
      : 'Vérifiez les spécifications de votre broker avant d’utiliser ces valeurs pour calculer le risque.',
    requiresReview: true,
    modelUsed: result.modelUsed,
  });
}
