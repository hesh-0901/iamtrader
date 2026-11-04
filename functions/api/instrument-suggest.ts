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

type InstrumentProfile = {
  name: string;
  category: Category;
  priceStep: number | null;
  valuePerPriceUnit: number | null;
  defaultPositionSize: number;
  broker: string;
  contractSize?: number;
  contractUnit?: string;
  pipSize?: number;
  minVolume?: number;
  profitCurrency?: string;
  sourceUrl: string;
  note: string;
};

const EXNESS_TERMS = 'https://get.exness.help/hc/fr/articles/360014740179-Termes-de-trading-courants';
const EXNESS_FOREX = 'https://get.exness.help/hc/fr/articles/17854278192284-Forex';
const EXNESS_COMMODITIES = 'https://get.exness.help/hc/fr/articles/17854173039388-Mati%C3%A8res-premi%C3%A8res';
const EXNESS_INDICES = 'https://get.exness.help/hc/en-us/articles/17854383867548-Indices';
const EXNESS_STOCKS = 'https://get.exness.help/hc/fr/articles/17854435814428-Actions';

const currencyNames: Record<string, string> = {
  USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound', JPY: 'Japanese Yen',
  CHF: 'Swiss Franc', CAD: 'Canadian Dollar', AUD: 'Australian Dollar',
  NZD: 'New Zealand Dollar', CNY: 'Chinese Yuan', CNH: 'Offshore Chinese Yuan',
  HKD: 'Hong Kong Dollar', SGD: 'Singapore Dollar', ZAR: 'South African Rand',
  MXN: 'Mexican Peso', NOK: 'Norwegian Krone', SEK: 'Swedish Krona',
  DKK: 'Danish Krone', PLN: 'Polish Zloty', TRY: 'Turkish Lira',
  THB: 'Thai Baht', ILS: 'Israeli Shekel', BTC: 'Bitcoin', ETH: 'Ethereum',
  USDT: 'Tether',
};

const indexProfiles: Record<string, { name: string; priceStep: number; contractSize: number; minVolume: number; sourceUrl: string }> = {
  US30: { name: 'US Wall Street 30', priceStep: 1, contractSize: 1, minVolume: 0.05, sourceUrl: EXNESS_INDICES },
  US30_X10: { name: 'US Wall Street 30 x10', priceStep: 1, contractSize: 10, minVolume: 0.01, sourceUrl: EXNESS_INDICES },
  USTEC: { name: 'NASDAQ 100', priceStep: 0.1, contractSize: 1, minVolume: 0.05, sourceUrl: EXNESS_INDICES },
  USTEC_X100: { name: 'NASDAQ 100 x100', priceStep: 0.1, contractSize: 100, minVolume: 0.01, sourceUrl: EXNESS_INDICES },
  US500: { name: 'S&P 500', priceStep: 0.1, contractSize: 1, minVolume: 0.14, sourceUrl: EXNESS_INDICES },
  US500_X100: { name: 'S&P 500 x100', priceStep: 0.1, contractSize: 100, minVolume: 0.03, sourceUrl: EXNESS_INDICES },
  DE30: { name: 'DAX 40', priceStep: 1, contractSize: 1, minVolume: 0.07, sourceUrl: EXNESS_INDICES },
  FR40: { name: 'CAC 40', priceStep: 0.1, contractSize: 1, minVolume: 0.05, sourceUrl: EXNESS_INDICES },
  UK100: { name: 'FTSE 100', priceStep: 0.1, contractSize: 1, minVolume: 0.1, sourceUrl: EXNESS_INDICES },
  HK50: { name: 'Hang Seng 50', priceStep: 1, contractSize: 1, minVolume: 0.07, sourceUrl: EXNESS_INDICES },
  JP225: { name: 'Nikkei 225', priceStep: 1, contractSize: 1, minVolume: 3, sourceUrl: EXNESS_INDICES },
  AUS200: { name: 'ASX 200', priceStep: 0.1, contractSize: 1, minVolume: 0.06, sourceUrl: EXNESS_INDICES },
};

const stockSymbols = new Set((
  'AAPL ABBV ABT ADBE ADP AMD AMGN AMZN AMT ATVI AVGO BA BAC BABA BEKE BILI BIIB BIDU BMY C CHTR CMCSA CME COST CSX CSCO CVS EBAY EDU EQIX F FTNT FUTU GILD GOOGL HD IBM INTC INTU ISRG JD JNJ JPM KO LI LIN LLY LMT MA MCD MDLZ META MMM MO MRK MS MSFT NIO NKE NFLX NTES NVDA ORCL PDD PEP PFE PG PM PYPL REGN SBUX SPCX T TAL TME TMO TMUS TSM TSLA UNH UPS V VIPS VZ VRTX WFC WMT XPEV XOM YUMC ZTO'
).split(' '));

const cryptoSymbols = new Set(['BTCUSD', 'ETHUSD', 'BTCUSDT', 'ETHBTC']);
const metalContracts: Record<string, { contractSize: number; contractUnit: string; pipSize: number }> = {
  XAUUSD: { contractSize: 100, contractUnit: 'troy ounces', pipSize: 0.01 },
  XAUUSD247: { contractSize: 100, contractUnit: 'troy ounces', pipSize: 0.01 },
  XAGUSD: { contractSize: 5000, contractUnit: 'troy ounces', pipSize: 0.01 },
  XPTUSD: { contractSize: 100, contractUnit: 'troy ounces', pipSize: 0.1 },
  XPDUSD: { contractSize: 100, contractUnit: 'troy ounces', pipSize: 0.1 },
};

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

const symbolAliases: Record<string, string> = {
  NAS100: 'USTEC', SPX500: 'US500', GER40: 'DE30', DAX40: 'DE30',
  US30X10: 'US30_X10', USTECX100: 'USTEC_X100', NAS100X100: 'USTEC_X100',
  US500X100: 'US500_X100', SPX500X100: 'US500_X100',
};

function fallbackProfile(symbol: string, accountCurrency: string): InstrumentProfile {
  const forexMatch = /^([A-Z]{3})([A-Z]{3})$/.exec(symbol);
  if (symbol === 'DXY') {
    return {
      name: 'US Dollar Index', category: 'forex', priceStep: 0.01,
      valuePerPriceUnit: accountCurrency === 'USD' ? 1000 : null, defaultPositionSize: 0.01,
      broker: 'Exness', contractSize: 1000, contractUnit: 'contracts', pipSize: 0.01,
      minVolume: 0.01, profitCurrency: 'USD', sourceUrl: EXNESS_FOREX,
      note: 'Profil Exness : contrat DXY de 1 000 unités et pip de 0,01. Valeur par variation de 1,00 exprimée en USD ; conversion requise pour les comptes EUR/GBP.',
    };
  }
  if (forexMatch && currencyNames[forexMatch[1]] && currencyNames[forexMatch[2]]) {
    const [, base, quote] = forexMatch;
    const pip = quote === 'JPY' ? 0.01 : 0.0001;
    return {
      name: currencyNames[base] + ' / ' + currencyNames[quote], category: 'forex',
      priceStep: pip / 10,
      valuePerPriceUnit: quote === accountCurrency ? 100000 : null,
      defaultPositionSize: 0.01, broker: 'Exness', contractSize: 100000,
      contractUnit: 'base currency units', pipSize: pip, minVolume: 0.01,
      profitCurrency: quote, sourceUrl: EXNESS_FOREX,
      note: quote === accountCurrency
        ? 'Profil Forex Exness : contrat standard de 100 000 unités de devise de base. La valeur est calculée dans la devise du compte car elle correspond à la devise de cotation.'
        : 'Paire Forex reconnue et contrat standard Exness de 100 000 unités. La valeur par mouvement de prix doit être convertie depuis ' + quote + ' vers ' + accountCurrency + ' ; elle reste volontairement vide pour éviter un calcul erroné.',
    };
  }

  if (metalContracts[symbol]) {
    const spec = metalContracts[symbol];
    const quote = symbol === 'XAUUSD247' ? 'USD' : symbol.slice(-3);
    return {
      name: symbol.startsWith('XAU') ? 'Gold / ' + (currencyNames[quote] || quote)
        : symbol.startsWith('XAG') ? 'Silver / ' + (currencyNames[quote] || quote)
        : symbol.startsWith('XPT') ? 'Platinum / ' + (currencyNames[quote] || quote)
        : 'Palladium / ' + (currencyNames[quote] || quote),
      category: 'metal', priceStep: spec.pipSize / 10,
      valuePerPriceUnit: quote === accountCurrency ? spec.contractSize : null,
      defaultPositionSize: 0.01, broker: 'Exness', ...spec,
      profitCurrency: quote, sourceUrl: EXNESS_COMMODITIES,
      note: 'Spécifications contractuelles Exness publiées. La valeur par mouvement de 1,00 est égale à la taille du contrat dans la devise de cotation ; elle n’est préremplie que si cette devise correspond à celle du compte.',
    };
  }

  if (symbol === 'UKOIL' || symbol === 'USOIL') {
    return {
      name: symbol === 'UKOIL' ? 'Brent Crude Oil' : 'US Crude Oil',
      category: 'futures', priceStep: 0.001,
      valuePerPriceUnit: accountCurrency === 'USD' ? 1000 : null,
      defaultPositionSize: 0.01, broker: 'Exness', contractSize: 1000,
      contractUnit: 'barrels', pipSize: 0.01, minVolume: 0.01,
      profitCurrency: 'USD', sourceUrl: EXNESS_COMMODITIES,
      note: 'Contrat Exness publié : 1 000 barils par lot. Valeur par variation de 1,00 : 1 000 USD par lot, uniquement pour un compte USD.',
    };
  }
  if (symbol === 'XNGUSD') {
    return {
      name: 'Natural Gas / US Dollar', category: 'futures', priceStep: 0.0001,
      valuePerPriceUnit: accountCurrency === 'USD' ? 10000 : null,
      defaultPositionSize: 0.01, broker: 'Exness', contractSize: 10000,
      contractUnit: 'MMBtu', pipSize: 0.001, minVolume: 0.01,
      profitCurrency: 'USD', sourceUrl: EXNESS_COMMODITIES,
      note: 'Contrat Exness publié : 10 000 MMBtu par lot. Valeur par variation de 1,00 : 10 000 USD par lot, uniquement pour un compte USD.',
    };
  }

  const index = indexProfiles[symbol];
  if (index) {
    const usdIndex = ['US30', 'US30_X10', 'USTEC', 'USTEC_X100', 'US500', 'US500_X100'].includes(symbol);
    return {
      name: index.name, category: 'index', priceStep: index.priceStep,
      valuePerPriceUnit: accountCurrency === 'USD' && usdIndex ? index.contractSize : null,
      defaultPositionSize: index.minVolume, broker: 'Exness',
      contractSize: index.contractSize, contractUnit: 'index contracts',
      pipSize: index.priceStep, minVolume: index.minVolume,
      profitCurrency: usdIndex ? 'USD' : undefined, sourceUrl: index.sourceUrl,
      note: usdIndex && accountCurrency === 'USD'
        ? 'Contrat Exness documenté. Valeur par variation de 1,00 calculée à partir de la taille du contrat ; minimum de volume issu de la fiche Exness.'
        : 'Indice reconnu avec pas de cotation et taille du contrat issus de la fiche Exness. La devise de profit ou la conversion vers ' + accountCurrency + ' doit être confirmée dans les spécifications du symbole MT5 avant de renseigner sa valeur.',
    };
  }

  if (stockSymbols.has(symbol)) {
    return {
      name: symbol + ' Stock CFD', category: 'stock', priceStep: 0.01,
      valuePerPriceUnit: accountCurrency === 'USD' ? 100 : null,
      defaultPositionSize: 0.01, broker: 'Exness', contractSize: 100,
      contractUnit: 'shares', pipSize: 0.1, minVolume: 0.01,
      profitCurrency: 'USD', sourceUrl: EXNESS_STOCKS,
      note: 'Spécifications générales des CFD actions Exness : 100 actions par lot et pip de 0,1. La valeur n’est préremplie que pour les comptes USD ; vérifiez les exceptions propres au symbole.',
    };
  }

  if (cryptoSymbols.has(symbol)) {
    const quote = symbol.endsWith('USDT') ? 'USDT' : symbol.endsWith('USD') ? 'USD' : 'BTC';
    return {
      name: symbol.replace('BTC', 'Bitcoin').replace('ETH', 'Ethereum'),
      category: 'crypto', priceStep: symbol === 'BTCUSD' || symbol === 'ETHUSD' ? 0.01 : 0.0001,
      valuePerPriceUnit: quote === accountCurrency ? 1 : null,
      defaultPositionSize: 0.01, broker: 'Exness', contractSize: 1,
      contractUnit: 'coin', pipSize: symbol === 'BTCUSD' || symbol === 'ETHUSD' ? 0.1 : undefined,
      minVolume: 0.01, profitCurrency: quote, sourceUrl: EXNESS_TERMS,
      note: 'Contrat crypto standard Exness : 1 coin par lot. La valeur par variation de 1,00 est exprimée dans la devise de cotation ; elle n’est préremplie que si elle correspond à la devise du compte.',
    };
  }

  const category: Category = /^[A-Z]{6}$/.test(symbol) ? 'forex'
    : /^(XAU|XAG|XPT|XPD|XCU|XAL|XNI|XPB|XZN)/.test(symbol) ? 'metal'
    : /^(US|UK|WTI|BRENT|XNG)/.test(symbol) ? 'futures'
    : /^[A-Z]{1,6}$/.test(symbol) ? 'other' : 'other';
  const guessedStep = category === 'forex' ? (symbol.endsWith('JPY') ? 0.001 : 0.00001)
    : category === 'metal' ? 0.001 : null;
  return {
    name: symbol, category, priceStep: guessedStep, valuePerPriceUnit: null,
    defaultPositionSize: 0.01, broker: 'À confirmer', sourceUrl: EXNESS_TERMS,
    note: 'Symbole reconnu, mais aucune fiche contractuelle suffisamment précise n’a été trouvée dans le catalogue de secours. Le pas de cotation proposé est indicatif ; renseignez la valeur par mouvement de 1,00 à partir des spécifications de votre broker/MT5. Aucun montant n’est inventé.',
  };
}

export async function onRequest(context: { request: Request; env: Env }) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { Allow: 'POST, OPTIONS', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' },
    });
  }
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  let body: { symbol?: unknown; accountCurrency?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return json({ error: 'Requête invalide.' }, 400); }

  const symbol = typeof body.symbol === 'string' ? body.symbol.trim().toUpperCase() : '';
  const accountCurrency = typeof body.accountCurrency === 'string' && /^[A-Z]{3}$/.test(body.accountCurrency.toUpperCase())
    ? body.accountCurrency.toUpperCase() : 'USD';

  if (!symbol || symbol.length > 24 || !/^[A-Z0-9._-]+$/.test(symbol)) {
    return json({ error: 'Saisissez un symbole valide (ex. XAUUSD ou EURUSD).' }, 400);
  }

  const catalogSymbol = symbolAliases[symbol.replace(/[^A-Z0-9]/g, '')] ?? symbol;
  const fallback = fallbackProfile(catalogSymbol, accountCurrency);
  const hasVerifiedValue = fallback.valuePerPriceUnit !== null && fallback.priceStep !== null;
  // Fully specified Exness catalogue entries are deterministic and do not depend on an AI provider.
  if (hasVerifiedValue && fallback.broker === 'Exness') {
    return json({
      instrument: {
        symbol, name: fallback.name, category: fallback.category,
        priceStep: fallback.priceStep, valuePerPriceUnit: fallback.valuePerPriceUnit,
        defaultPositionSize: fallback.defaultPositionSize,
      },
      brokerSpecs: {
        broker: fallback.broker, contractSize: fallback.contractSize ?? 0,
        contractUnit: fallback.contractUnit ?? 'contracts', pipSize: fallback.pipSize ?? fallback.priceStep ?? 0,
        minVolume: fallback.minVolume ?? fallback.defaultPositionSize,
        valueCurrency: fallback.profitCurrency ?? accountCurrency, sourceUrl: fallback.sourceUrl,
      },
      note: fallback.note, requiresReview: true, provider: 'exness-catalogue',
    });
  }

  if (!isInstrumentAIConfigured(env)) {
    return json({
      instrument: {
        symbol, name: fallback.name, category: fallback.category,
        priceStep: fallback.priceStep, valuePerPriceUnit: fallback.valuePerPriceUnit,
        defaultPositionSize: fallback.defaultPositionSize,
      },
      brokerSpecs: fallback.broker !== 'À confirmer' ? {
        broker: fallback.broker, contractSize: fallback.contractSize ?? 0,
        contractUnit: fallback.contractUnit ?? 'contracts', pipSize: fallback.pipSize ?? fallback.priceStep ?? 0,
        minVolume: fallback.minVolume ?? fallback.defaultPositionSize,
        valueCurrency: fallback.profitCurrency ?? accountCurrency, sourceUrl: fallback.sourceUrl,
      } : undefined,
      note: fallback.note, error: 'Chloé est indisponible ; le catalogue de secours a été utilisé.',
      requiresReview: true, provider: 'local-catalogue',
    });
  }

  const prompt = `Tu aides à configurer un instrument de trading dans IAMTRADER. Retourne exclusivement un objet JSON avec les clés symbol, name, category, priceStep, valuePerPriceUnit, defaultPositionSize, note.
Symbole : ${symbol}
Devise du compte : ${accountCurrency}
Catégories autorisées : ${categories.join(', ')}.
priceStep est le plus petit incrément de cotation réel du symbole chez le broker.
valuePerPriceUnit est le résultat/perte dans la devise du compte pour un mouvement de prix de 1,00 et une unité de taille de position.
Ne suppose jamais un contrat CFD standard. Les tailles de contrat, devises de profit et valeurs dépendent du symbole et du broker. Si une valeur n'est pas certaine, retourne null.
Taille par défaut : ${fallback.defaultPositionSize}. Profil local connu : ${JSON.stringify({ category: fallback.category, priceStep: fallback.priceStep, name: fallback.name })}.
N'invente pas de source ni de validation officielle.`;

  const result = await callAI('instrument-suggest', prompt, env, { responseJson: true });
  if (!result.success || !result.text) {
    console.warn('[InstrumentSuggest] All configured AI providers unavailable', {
      model: result.modelUsed, status: result.httpStatus,
      provider: result.keyAlias === 'OPENAI_PRIMARY' ? 'openai' : 'gemini',
    });
    return json({
      instrument: {
        symbol, name: fallback.name, category: fallback.category,
        priceStep: fallback.priceStep, valuePerPriceUnit: fallback.valuePerPriceUnit,
        defaultPositionSize: fallback.defaultPositionSize,
      },
      note: fallback.note, error: 'Chloé est indisponible ; le catalogue de secours a été utilisé.',
      requiresReview: true, provider: 'local-catalogue',
    });
  }

  let suggestion: Record<string, unknown>;
  try {
    const clean = result.text.replace(/```json/gi, '').replace(/```/g, '').trim();
    suggestion = JSON.parse(clean) as Record<string, unknown>;
  } catch {
    return json({
      instrument: {
        symbol, name: fallback.name, category: fallback.category,
        priceStep: fallback.priceStep, valuePerPriceUnit: fallback.valuePerPriceUnit,
        defaultPositionSize: fallback.defaultPositionSize,
      },
      note: fallback.note, error: 'Réponse IA illisible ; catalogue de secours utilisé.',
      requiresReview: true, provider: 'local-catalogue',
    });
  }

  const category: Category = categories.includes(suggestion.category as Category) ? suggestion.category as Category : fallback.category;
  // Contract economics are never trusted from AI; only verified catalogue values may prefill them.
  const priceStep = fallback.priceStep;
  const valuePerPriceUnit = fallback.valuePerPriceUnit;
  const defaultPositionSize = positiveNumber(suggestion.defaultPositionSize) ?? fallback.defaultPositionSize;

  return json({
    instrument: {
      symbol, name: typeof suggestion.name === 'string' && suggestion.name.trim()
        ? suggestion.name.trim().slice(0, 80) : fallback.name,
      category, priceStep, valuePerPriceUnit, defaultPositionSize,
    },
    note: typeof suggestion.note === 'string' ? suggestion.note.trim().slice(0, 500) + ' ' + fallback.note : fallback.note,
    requiresReview: true, provider: result.keyAlias === 'OPENAI_PRIMARY' ? 'openai' : 'gemini',
    modelUsed: result.modelUsed,
  });
}
