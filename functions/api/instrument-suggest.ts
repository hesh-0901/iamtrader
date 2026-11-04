import { callAI, isInstrumentAIConfigured } from './common/ai-core';

interface Env {
  GEMINI_API_KEY?: string;
  GEMINI_API_KEY_2?: string;
  GEMINI_API_KEY_3?: string;
  GEMINI_API_KEY_4?: string;
  GEMINI_MODEL?: string;
  GEMINI_CHLOE_MODEL?: string;
  GEMINI_INSTRUMENT_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_INSTRUMENT_MODEL?: string;
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

  // Verified Exness XAUUSD contract profile; this deterministic path does not depend on AI availability.
  // valuePerPriceUnit is USD per 1.00 price move for 1.00 lot.
  if (symbol === 'XAUUSD' && accountCurrency === 'USD') {
    return json({
      instrument: { symbol: 'XAUUSD', name: 'Gold / US Dollar', category: 'metal', priceStep: 0.01, valuePerPriceUnit: 100, defaultPositionSize: 0.01 },
      brokerSpecs: { broker: 'Exness', contractSize: 100, contractUnit: 'troy ounces', pipSize: 0.01, minVolume: 0.01, valueCurrency: 'USD', sourceUrl: 'https://get.exness.help/hc/fr/articles/17854173039388-Mati%C3%A8res-premi%C3%A8res' },
      note: 'Profil Exness vérifié : contrat de 100 onces troy par lot, pip de 0,01 et volume minimum de 0,01 lot. Pour 1 lot, un mouvement de 1,00 vaut 100 USD (soit 1 USD par pip de 0,01). Le volume par défaut est réglé au minimum Exness de 0,01 lot. Vérifiez le symbole et les conditions de votre type de compte dans MT5 avant utilisation.',
      requiresReview: true,
      provider: 'exness-specifications',
    });
  }
  if (!isInstrumentAIConfigured(env)) {
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
Fais une proposition pratique à partir des spécifications usuelles connues. N'invente pas une certitude : le contrat, la taille de lot et la valeur peuvent varier selon le broker, notamment pour les CFD, indices, futures et paires dont la devise de cotation diffère de celle du compte. Explique brièvement cette réserve dans note. Ne prétends pas avoir consulté le broker de l'utilisateur. Si l'actif ou ses spécifications sont inconnus, ne devine PAS priceStep ni valuePerPriceUnit : retourne null pour ces deux champs et explique dans note que les spécifications du broker sont nécessaires.
defaultPositionSize doit être 1. N'invente jamais priceStep ni valuePerPriceUnit.`;

  // The central AI Core selects the instrument-specific configured model.
  const result = await callAI('instrument-suggest', prompt, env, { responseJson: true });

  if (!result.success || !result.text) {
    console.warn('[InstrumentSuggest] All configured AI providers unavailable', {
      model: result.modelUsed,
      status: result.httpStatus,
      provider: result.keyAlias === 'OPENAI_PRIMARY' ? 'openai' : 'gemini',
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
      : 'Les spécifications contractuelles peuvent varier selon le broker. Les champs non vérifiés doivent être complétés avant tout calcul de risque.',
    requiresReview: true,
    provider: result.keyAlias === 'OPENAI_PRIMARY' ? 'openai' : 'gemini',
    modelUsed: result.modelUsed,
  });
}
