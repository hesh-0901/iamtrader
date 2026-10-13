interface Env {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
}

const categories = ['forex', 'metal', 'index', 'futures', 'crypto', 'stock', 'other'] as const;
type Category = typeof categories[number];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function positiveNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export async function onRequest(context: { request: Request; env: Env }) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      Allow: 'POST, OPTIONS',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }});
  }
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  if (!env.GEMINI_API_KEY?.trim()) return json({ error: 'Chloé n’est pas configurée sur le serveur.' }, 503);

  let body: { symbol?: unknown; accountCurrency?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return json({ error: 'Requête invalide.' }, 400); }

  const symbol = typeof body.symbol === 'string' ? body.symbol.trim().toUpperCase() : '';
  const accountCurrency = typeof body.accountCurrency === 'string' && /^[A-Z]{3}$/.test(body.accountCurrency.toUpperCase())
    ? body.accountCurrency.toUpperCase()
    : 'USD';
  if (!symbol || symbol.length > 24 || !/^[A-Z0-9._-]+$/.test(symbol)) {
    return json({ error: 'Saisissez un symbole valide (ex. XAUUSD ou EURUSD).'}, 400);
  }

  const prompt = `Tu aides à configurer un instrument de trading dans IAMTRADER. Retourne exclusivement un objet JSON, sans markdown, avec ces clés : symbol, name, category, priceStep, valuePerPriceUnit, defaultPositionSize, note.
Symbole saisi : ${symbol}
Devise du compte : ${accountCurrency}
category doit être l'une de : ${categories.join(', ')}.
priceStep est le plus petit incrément de cotation habituel (par exemple 0.01 pour XAUUSD ou 0.0001 pour la plupart des paires Forex).
valuePerPriceUnit est le gain/perte approximatif, dans la devise du compte indiquée, pour un mouvement de prix de 1.00 et une unité de taille de position, selon un contrat standard courant. defaultPositionSize doit être 1.
Fais une proposition pratique à partir des spécifications usuelles connues. N'invente pas une certitude : le contrat, la taille de lot et la valeur peuvent varier selon le broker, notamment pour les CFD, indices, futures et paires dont la devise de cotation diffère de celle du compte. Explique brièvement cette réserve dans note. Ne prétends pas avoir consulté le broker de l'utilisateur. Si l'actif est inconnu, utilise category "other", name égal au symbole, priceStep 0.01 et valuePerPriceUnit 1 comme valeurs provisoires clairement signalées dans note.
Tous les nombres doivent être strictement positifs.`;

  try {
    const model = (env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'x-goog-api-key': env.GEMINI_API_KEY!.trim(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 400 },
        }),
        signal: AbortSignal.timeout(12000),
      },
    );
    const raw = await response.text();
    let data: any = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch {}
    if (!response.ok) {
      console.error('Instrument suggestion Gemini error:', response.status, raw.slice(0, 1000));
      return json({ error: 'Chloé n’a pas pu compléter cet instrument. Réessayez.' }, 502);
    }
    const output = data?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('\n').trim();
    if (!output) return json({ error: 'Chloé n’a retourné aucune suggestion.' }, 502);

    let suggestion: any;
    try { suggestion = JSON.parse(output); }
    catch { return json({ error: 'La suggestion de Chloé était illisible. Réessayez.' }, 502); }

    const category: Category = categories.includes(suggestion.category) ? suggestion.category : 'other';
    const priceStep = positiveNumber(suggestion.priceStep);
    const valuePerPriceUnit = positiveNumber(suggestion.valuePerPriceUnit);
    const defaultPositionSize = positiveNumber(suggestion.defaultPositionSize) ?? 1;
    if (!priceStep || !valuePerPriceUnit) {
      return json({ error: 'Les paramètres numériques proposés sont incomplets. Veuillez réessayer.' }, 502);
    }

    return json({
      instrument: {
        symbol,
        name: typeof suggestion.name === 'string' && suggestion.name.trim() ? suggestion.name.trim().slice(0, 80) : symbol,
        category,
        priceStep,
        valuePerPriceUnit,
        defaultPositionSize,
      },
      note: typeof suggestion.note === 'string' ? suggestion.note.trim().slice(0, 500) : 'Vérifiez les spécifications de votre broker avant d’utiliser ces valeurs pour calculer le risque.',
      requiresReview: true,
    });
  } catch (error) {
    console.error('Instrument suggestion failed:', error);
    return json({ error: 'Chloé est temporairement indisponible. Vous pouvez compléter l’instrument manuellement.' }, 502);
  }
}
